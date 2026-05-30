import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { DisputesService } from "../disputes/disputes.service";
import { ListingStatus } from "@prisma/client";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly disputesService: DisputesService
  ) {}

  // 1. Listings Moderation
  async getPendingListings() {
    return this.prisma.listing.findMany({
      where: { status: ListingStatus.PENDING },
      include: {
        seller: { select: { name: true, mobile: true, trustScore: true } },
        ticketUpload: true,
      },
    });
  }

  async approveListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException("Listing not found.");
    }

    return this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.ACTIVE },
    });
  }

  async rejectListing(listingId: string, reason: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException("Listing not found.");
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.REJECTED },
    });

    // Notify seller
    await this.prisma.notification.create({
      data: {
        userId: listing.sellerId,
        title: "Ticket Listing Rejected ❌",
        message: `Your ticket resale listing for "${listing.movieName}" was rejected by moderator. Reason: ${reason || "Invalid ticket details"}`,
        type: "LISTING_REJECTED",
      },
    });

    return updated;
  }

  // 2. Withdrawals Moderation
  async getWithdrawRequests() {
    return this.prisma.withdrawRequest.findMany({
      include: {
        wallet: {
          include: {
            user: { select: { name: true, mobile: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async approveWithdraw(requestId: string) {
    return this.walletService.approveWithdraw(requestId);
  }

  async rejectWithdraw(requestId: string, reason: string) {
    return this.walletService.rejectWithdraw(requestId, reason);
  }

  // 3. User Accounts Actions
  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User account not found.");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: "SUSPENDED" },
    });
  }

  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User account not found.");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });
  }
}
