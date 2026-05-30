import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { RaiseDisputeDto } from "./dto/raise-dispute.dto";
import { OrderStatus, EscrowStatus, DisputeStatus, TransactionType, PaymentStatus } from "@prisma/client";

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Raise a new dispute (Only by paid Buyer)
  async raiseDispute(buyerId: string, raiseDisputeDto: RaiseDisputeDto) {
    const { orderId, reason, evidenceUrls } = raiseDisputeDto;

    // A. Verify order eligibility
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
      include: { listing: true, escrow: true },
    });

    if (!order) {
      throw new NotFoundException("Order not found or restricted access.");
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(`Cannot dispute an order in ${order.status} state. It must be PAID.`);
    }

    const escrow = order.escrow;
    if (!escrow) {
      throw new BadRequestException("Escrow record not found for this order.");
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(`Escrow holds are not active: ${escrow.status}`);
    }

    // B. Create Dispute and freeze escrow within a transaction
    const dispute = await this.prisma.$transaction(async (tx) => {
      // 1. Freeze Escrow Hold immediately
      await tx.escrow.update({
        where: { orderId },
        data: { status: EscrowStatus.FROZEN },
      });

      // 2. Set Order Status to DISPUTED
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DISPUTED },
      });

      // 3. Create Dispute Entry
      const disp = await tx.dispute.create({
        data: {
          orderId,
          raiserId: buyerId,
          reason,
          evidenceUrls: evidenceUrls || [],
          status: DisputeStatus.OPEN,
        },
      });

      // 4. Notify Seller
      await tx.notification.create({
        data: {
          userId: order.listing.sellerId,
          title: "Ticket Disputed ⚠️",
          message: `Buyer raised a dispute for "${order.listing.movieName}". Escrow payout of ₹${order.amount} is FROZEN.`,
          type: "DISPUTE_ALERT",
        },
      });

      // 5. Notify Buyer
      await tx.notification.create({
        data: {
          userId: buyerId,
          title: "Dispute Registered ⚖️",
          message: `Your dispute for order #${orderId} has been registered. An admin will review details shortly.`,
          type: "DISPUTE_OPENED",
        },
      });

      return disp;
    });

    return dispute;
  }

  // 2. Fetch specific dispute details
  async findOne(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            listing: true,
            buyer: { select: { id: true, name: true, mobile: true, trustScore: true } },
          },
        },
        raiser: { select: { id: true, name: true, mobile: true, trustScore: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute record not found.");
    }

    return dispute;
  }

  // 3. Fetch all disputes (For Admin Dashboard)
  async findAll() {
    return this.prisma.dispute.findMany({
      include: {
        raiser: { select: { name: true } },
        order: { select: { listingId: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // 4. Admin Resolution: Refund Buyer (Seller gets penalized)
  async resolveRefund(disputeId: string, adminNotes: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found.");
    }

    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Dispute is already resolved: ${dispute.status}`);
    }

    const orderId = dispute.orderId;
    const amount = dispute.order.amount;
    const buyerId = dispute.order.buyerId;
    const sellerId = dispute.order.listing.sellerId;

    await this.prisma.$transaction(async (tx) => {
      // A. Update Dispute
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED_REFUND,
          adminNotes,
          resolvedAt: new Date(),
        },
      });

      // B. Update Order, Escrow and Payment statuses
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUNDED },
      });

      await tx.escrow.update({
        where: { orderId },
        data: { status: EscrowStatus.REFUNDED },
      });

      await tx.payment.update({
        where: { orderId },
        data: { status: PaymentStatus.REFUNDED },
      });

      // C. Subtract held earnings from Seller's wallet escrowBalance
      const sellerWallet = await tx.wallet.update({
        where: { userId: sellerId },
        data: {
          escrowBalance: { decrement: amount },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: sellerWallet.id,
          amount,
          type: TransactionType.REFUND,
          description: `Dispute Refund Deduction: Order #${orderId}`,
        },
      });

      // D. Penalize Seller trustScore (-10 trust) for fraud/invalid ticket submission
      const seller = await tx.user.findUnique({ where: { id: sellerId } });
      if (seller) {
        const newScore = Math.max(0, seller.trustScore - 10);
        await tx.user.update({
          where: { id: sellerId },
          data: { trustScore: newScore },
        });
      }

      // E. Add funds to Buyer's spendable Wallet balance (Store Credit Refund)
      const buyerWallet = await tx.wallet.upsert({
        where: { userId: buyerId },
        create: {
          userId: buyerId,
          balance: amount,
          escrowBalance: 0,
        },
        update: {
          balance: { increment: amount },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: buyerWallet.id,
          amount,
          type: TransactionType.REFUND,
          description: `Dispute Store Credit Refund: Order #${orderId}`,
        },
      });

      // F. Send notifications
      await tx.notification.create({
        data: {
          userId: buyerId,
          title: "Refund Approved! 💰",
          message: `Your dispute for order #${orderId} was resolved. ₹${amount} refunded to your spendable wallet balance.`,
          type: "DISPUTE_REFUNDED",
        },
      });

      await tx.notification.create({
        data: {
          userId: sellerId,
          title: "Dispute Lost ❌",
          message: `Admin resolved dispute for order #${orderId} in favor of buyer. Held funds deducted. Trust rating reduced.`,
          type: "DISPUTE_LOST",
        },
      });
    });

    return { success: true, message: "Dispute resolved in favor of Buyer. Refund issued." };
  }

  // 5. Admin Resolution: Release Payout to Seller
  async resolveRelease(disputeId: string, adminNotes: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found.");
    }

    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Dispute is already resolved: ${dispute.status}`);
    }

    const orderId = dispute.orderId;
    const amount = dispute.order.amount;
    const buyerId = dispute.order.buyerId;
    const sellerId = dispute.order.listing.sellerId;

    await this.prisma.$transaction(async (tx) => {
      // A. Update Dispute
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED_RELEASE,
          adminNotes,
          resolvedAt: new Date(),
        },
      });

      // B. Update Order and Escrow statuses
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      await tx.escrow.update({
        where: { orderId },
        data: {
          status: EscrowStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      // C. Transfer Escrow holding to Seller's Spendable wallet balance
      const sellerWallet = await tx.wallet.update({
        where: { userId: sellerId },
        data: {
          escrowBalance: { decrement: amount },
          balance: { increment: amount },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: sellerWallet.id,
          amount,
          type: TransactionType.ESCROW_RELEASE,
          description: `Dispute Resolve: Escrow Payout Release Order #${orderId}`,
        },
      });

      // D. Restore/Reward Seller trust rating (+2 trust score, caps at 100)
      const seller = await tx.user.findUnique({ where: { id: sellerId } });
      if (seller && seller.trustScore < 100) {
        const newScore = Math.min(100, seller.trustScore + 2);
        await tx.user.update({
          where: { id: sellerId },
          data: { trustScore: newScore },
        });
      }

      // E. Send notifications
      await tx.notification.create({
        data: {
          userId: buyerId,
          title: "Dispute Closed ⚖️",
          message: `Admin resolved dispute for order #${orderId} in favor of seller. Payout released.`,
          type: "DISPUTE_CLOSED_SELLER",
        },
      });

      await tx.notification.create({
        data: {
          userId: sellerId,
          title: "Dispute Won! 🎉",
          message: `Admin resolved dispute in your favor for order #${orderId}. ₹${amount} added to spendable balance.`,
          type: "DISPUTE_WON",
        },
      });
    });

    return { success: true, message: "Dispute resolved in favor of Seller. Funds released." };
  }
}
