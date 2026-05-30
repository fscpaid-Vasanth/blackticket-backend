import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateWithdrawDto } from "./dto/create-withdraw.dto";
import { WithdrawStatus, TransactionType } from "@prisma/client";

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Fetch user's wallet info (lazily initialized if not exist)
  async getWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        withdrawRequests: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!wallet) {
      // Lazily initialize wallet
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          balance: 0,
          escrowBalance: 0,
        },
        include: {
          transactions: true,
          withdrawRequests: true,
        },
      });
    }

    return wallet;
  }

  // 2. Register withdrawal request, deduct immediately
  async requestWithdraw(userId: string, createWithdrawDto: CreateWithdrawDto) {
    const { amount, bankDetails } = createWithdrawDto;

    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new BadRequestException(`Insufficient spendable balance. Available: ₹${wallet.balance}`);
    }

    const request = await this.prisma.$transaction(async (tx) => {
      // A. Deduct amount from user's active wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
        },
      });

      // B. Create a PENDING WithdrawRequest
      const req = await tx.withdrawRequest.create({
        data: {
          walletId: wallet.id,
          amount,
          bankDetails: JSON.parse(JSON.stringify(bankDetails)),
          status: WithdrawStatus.PENDING,
        },
      });

      // C. Register withdrawal hold transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: TransactionType.WITHDRAW,
          description: `IMPS Bank Withdrawal Requested (Ref: #${req.id})`,
        },
      });

      // D. Notify user
      await tx.notification.create({
        data: {
          userId,
          title: "Withdrawal Registered 🏦",
          message: `Your request to withdraw ₹${amount} is under review. Transferred bank details: Acctending ...${bankDetails.accountNumber.slice(-4)}`,
          type: "WITHDRAW_PENDING",
        },
      });

      return req;
    });

    return request;
  }

  // 3. Admin: Approve withdrawal request
  async approveWithdraw(requestId: string) {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: requestId },
      include: { wallet: true },
    });

    if (!request) {
      throw new NotFoundException("Withdraw request not found.");
    }

    if (request.status !== WithdrawStatus.PENDING) {
      throw new BadRequestException(`Withdraw request is already in status: ${request.status}`);
    }

    await this.prisma.withdrawRequest.update({
      where: { id: requestId },
      data: { status: WithdrawStatus.APPROVED },
    });

    await this.prisma.notification.create({
      data: {
        userId: request.wallet.userId,
        title: "Withdrawal Approved! ✅",
        message: `Your bank payout of ₹${request.amount} has been successfully processed!`,
        type: "WITHDRAW_SUCCESS",
      },
    });

    return { success: true, message: "Withdraw request approved successfully." };
  }

  // 4. Admin: Reject withdrawal request, refunds the funds immediately
  async rejectWithdraw(requestId: string, reason: string) {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: requestId },
      include: { wallet: true },
    });

    if (!request) {
      throw new NotFoundException("Withdraw request not found.");
    }

    if (request.status !== WithdrawStatus.PENDING) {
      throw new BadRequestException(`Withdraw request is already in status: ${request.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      // A. Update status to REJECTED
      await tx.withdrawRequest.update({
        where: { id: requestId },
        data: { status: WithdrawStatus.REJECTED },
      });

      // B. Return deducted amount back to user's wallet
      await tx.wallet.update({
        where: { id: request.walletId },
        data: {
          balance: { increment: request.amount },
        },
      });

      // C. Register deposit refund transaction
      await tx.transaction.create({
        data: {
          walletId: request.walletId,
          amount: request.amount,
          type: TransactionType.DEPOSIT,
          description: `Refund: Rejected withdrawal #${requestId}. Reason: ${reason || "Invalid details"}`,
        },
      });

      // D. Notify user
      await tx.notification.create({
        data: {
          userId: request.wallet.userId,
          title: "Withdrawal Rejected ❌",
          message: `Withdrawal request of ₹${request.amount} was rejected. Funds returned. Reason: ${reason || "Invalid details"}`,
          type: "WITHDRAW_REJECTED",
        },
      });
    });

    return { success: true, message: "Withdraw request rejected and funds returned." };
  }
}
