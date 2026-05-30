import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { OrderStatus, PaymentStatus, EscrowStatus, TransactionType } from "@prisma/client";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import * as crypto from "crypto";
import Razorpay from "razorpay";

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue("escrow") private readonly escrowQueue: Queue
  ) {
    try {
      const keyId = this.configService.get<string>("payments.razorpayKeyId");
      const keySecret = this.configService.get<string>("payments.razorpayKeySecret");
      if (keyId && keySecret && !keyId.includes("mockKeyId")) {
        this.razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
      }
    } catch (error) {
      console.warn("Failed to initialize real Razorpay client. Falling back to Mock mode.");
    }
  }

  // 1. Initiate Payment: Create a Razorpay Order and store PENDING Payment record
  async initiate(buyerId: string, initiatePaymentDto: InitiatePaymentDto) {
    const { orderId } = initiatePaymentDto;

    // Fetch the order
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
      include: { listing: true },
    });

    if (!order) {
      throw new NotFoundException("Order not found or restricted access.");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order is already in ${order.status} state.`);
    }

    const keyId = this.configService.get<string>("payments.razorpayKeyId");

    // If real Razorpay client exists, create order
    if (this.razorpay) {
      try {
        const rzOrder = await this.razorpay.orders.create({
          amount: Math.round(order.amount * 100), // Razorpay accepts in Paise
          currency: "INR",
          receipt: order.id,
        });

        // Save or update payment details
        await this.prisma.payment.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            razorpayOrderId: rzOrder.id,
            amount: order.amount,
            status: PaymentStatus.PENDING,
          },
          update: {
            razorpayOrderId: rzOrder.id,
            status: PaymentStatus.PENDING,
          },
        });

        return {
          paymentMode: "LIVE",
          keyId,
          amount: rzOrder.amount,
          currency: rzOrder.currency,
          razorpayOrderId: rzOrder.id,
          orderId: order.id,
        };
      } catch (error) {
        console.error("Razorpay Order Creation Failed, falling back to mock mode:", error);
      }
    }

    // Mock Mode Fallback
    const mockRzOrderId = `order_mock_${crypto.randomBytes(6).toString("hex")}`;
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        razorpayOrderId: mockRzOrderId,
        amount: order.amount,
        status: PaymentStatus.PENDING,
      },
      update: {
        razorpayOrderId: mockRzOrderId,
        status: PaymentStatus.PENDING,
      },
    });

    return {
      paymentMode: "MOCK",
      keyId,
      amount: Math.round(order.amount * 100),
      currency: "INR",
      razorpayOrderId: mockRzOrderId,
      orderId: order.id,
      mockSignature: "mock_signature_approved",
    };
  }

  // 2. Verify Payment: signature checking, updates tables, creates active escrow & triggers BullMQ release job
  async verify(buyerId: string, verifyPaymentDto: VerifyPaymentDto) {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyPaymentDto;

    // Fetch the order
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
      include: { listing: true },
    });

    if (!order) {
      throw new NotFoundException("Order not found or restricted.");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("This order has already been processed.");
    }

    const keySecret = this.configService.get<string>("payments.razorpayKeySecret");
    const isMockOrder = razorpayOrderId.startsWith("order_mock_");

    // Perform signature check unless it is a mock transaction
    if (!isMockOrder && this.razorpay) {
      const hmac = crypto.createHmac("sha256", keySecret);
      hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
      const generatedSignature = hmac.digest("hex");

      if (generatedSignature !== razorpaySignature) {
        // Mark payment failed in DB
        await this.prisma.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.FAILED },
        });
        throw new BadRequestException("Security Breach: Invalid signature provided.");
      }
    } else {
      // Mock validation verification check
      if (razorpaySignature !== "mock_signature_approved" && !isMockOrder) {
        throw new BadRequestException("Invalid mock payment signature.");
      }
    }

    // Execute state changes inside a transaction to prevent database inconsistency
    const result = await this.prisma.$transaction(async (tx) => {
      // A. Update Payment status
      const payment = await tx.payment.update({
        where: { orderId },
        data: {
          razorpayPaymentId,
          status: PaymentStatus.SUCCESS,
        },
      });

      // B. Update Order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });

      // C. Update Listing status to SOLD
      const updatedListing = await tx.listing.update({
        where: { id: order.listingId },
        data: { status: "SOLD" },
      });

      // D. Setup Escrow hold record
      // releaseAt is Showtime + 30 minutes
      const showtimeDate = new Date(order.listing.showtime);
      const releaseAt = new Date(showtimeDate.getTime() + 30 * 60 * 1000);

      const escrow = await tx.escrow.create({
        data: {
          orderId,
          amount: order.amount,
          status: EscrowStatus.ACTIVE,
          releaseAt,
        },
      });

      // E. Update Seller's Wallet (Increase escrowBalance)
      const sellerWallet = await tx.wallet.upsert({
        where: { userId: order.listing.sellerId },
        create: {
          userId: order.listing.sellerId,
          escrowBalance: order.amount,
          balance: 0,
        },
        update: {
          escrowBalance: { increment: order.amount },
        },
      });

      // F. Create a transaction ledger record
      await tx.transaction.create({
        data: {
          walletId: sellerWallet.id,
          amount: order.amount,
          type: TransactionType.ESCROW_HOLD,
          description: `Escrow hold for resale ticket purchase: Order #${order.id}`,
        },
      });

      // G. Notify seller of sold ticket
      await tx.notification.create({
        data: {
          userId: order.listing.sellerId,
          title: "Ticket Sold! 🎟️",
          message: `Your resale ticket for "${order.listing.movieName}" has been purchased! Funds are held in escrow.`,
          type: "SOLD_ALERT",
        },
      });

      return { payment, order: updatedOrder, listing: updatedListing, escrow };
    });

    // H. Add delayed job in BullMQ to release escrow
    const delayMs = result.escrow.releaseAt.getTime() - Date.now();
    await this.escrowQueue.add(
      "release-escrow",
      { orderId },
      {
        delay: Math.max(0, delayMs),
        jobId: orderId, // Avoid duplicates by using orderId as jobId
        removeOnComplete: true,
      }
    );

    return {
      message: "Payment successfully verified and Escrow hold activated.",
      orderId: result.order.id,
      status: result.order.status,
    };
  }
}
