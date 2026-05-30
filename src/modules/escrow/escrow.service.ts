import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { EscrowStatus, OrderStatus, TransactionType, DisputeStatus } from "@prisma/client";

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Fetch details of an escrow hold
  async findOneByOrder(orderId: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            listing: true,
            buyer: {
              select: { id: true, name: true, mobile: true, trustScore: true },
            },
          },
        },
      },
    });

    if (!escrow) {
      throw new NotFoundException("Escrow hold record not found for this order.");
    }

    return escrow;
  }

  // 2. Perform release of escrow funds to Seller's Wallet (Triggered post-showtime + 30 mins)
  async releaseEscrow(orderId: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!escrow) {
      throw new NotFoundException(`No escrow record exists for order: ${orderId}`);
    }

    // If escrow is already released, skip
    if (escrow.status === EscrowStatus.RELEASED) {
      return { success: true, message: "Escrow was already released." };
    }

    // Ensure it is currently ACTIVE. If FROZEN (because of dispute), reject automatic release.
    if (escrow.status === EscrowStatus.FROZEN) {
      throw new BadRequestException("Escrow funds are FROZEN due to an active dispute. Release blocked.");
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(`Escrow cannot be released in its current state: ${escrow.status}`);
    }

    // Extra double-check: check if an open dispute exists on the order
    const activeDispute = await this.prisma.dispute.findUnique({
      where: { orderId },
    });

    if (activeDispute && activeDispute.status !== DisputeStatus.CLOSED) {
      // Freeze the escrow immediately
      await this.prisma.escrow.update({
        where: { orderId },
        data: { status: EscrowStatus.FROZEN },
      });
      throw new BadRequestException("Escrow hold has been frozen due to an unresolved active dispute.");
    }

    // Execute release transaction
    await this.prisma.$transaction(async (tx) => {
      // A. Update Escrow status
      await tx.escrow.update({
        where: { orderId },
        data: {
          status: EscrowStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      // B. Update Order status to COMPLETED
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      // C. Update Wallet balance
      // Decrease escrowBalance, increase standard balance (spendable wallet balance)
      const sellerWallet = await tx.wallet.update({
        where: { userId: escrow.order.listing.sellerId },
        data: {
          escrowBalance: { decrement: escrow.amount },
          balance: { increment: escrow.amount },
        },
      });

      // D. Log transaction ledger
      await tx.transaction.create({
        data: {
          walletId: sellerWallet.id,
          amount: escrow.amount,
          type: TransactionType.ESCROW_RELEASE,
          description: `Escrow payout released for sold ticket order #${orderId}`,
        },
      });

      // E. Increase Seller's trustScore (+2 trust, caps at 100) for successful delivery!
      const seller = await tx.user.findUnique({
        where: { id: escrow.order.listing.sellerId },
      });

      if (seller && seller.trustScore < 100) {
        const newScore = Math.min(100, seller.trustScore + 2);
        await tx.user.update({
          where: { id: seller.id },
          data: { trustScore: newScore },
        });
      }

      // F. Notify Seller
      await tx.notification.create({
        data: {
          userId: escrow.order.listing.sellerId,
          title: "Payout Released! 💰",
          message: `Your ticket resale earnings (₹${escrow.amount}) are now available for withdrawal in your wallet.`,
          type: "PAYOUT_RELEASE",
        },
      });
    });

    return {
      success: true,
      message: "Escrow funds successfully moved to seller's active wallet balance.",
    };
  }

  // 3. Freeze escrow hold when dispute is raised
  async freezeEscrow(orderId: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { orderId },
    });

    if (!escrow) {
      throw new NotFoundException("Escrow record not found.");
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(`Cannot freeze escrow in ${escrow.status} status.`);
    }

    await this.prisma.escrow.update({
      where: { orderId },
      data: { status: EscrowStatus.FROZEN },
    });

    return { success: true, message: "Escrow funds frozen pending dispute review." };
  }
}
