import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { S3Service } from "../../config/s3.service";
import { AccessAction, OrderStatus } from "@prisma/client";

@Injectable()
export class TicketsService {
  private readonly logger = new Logger("TicketsService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service
  ) {}

  // Upload ticket file to AWS S3 and register the S3 key in the database
  async uploadTicket(sellerId: string, listingId: string, file: Express.Multer.File) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException("Resale listing not found.");
    }

    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException("Unauthorized. You are not the owner of this listing.");
    }

    // Build a unique S3 object key: tickets/<listingId>/<timestamp>_<originalname>
    const timestamp = Date.now();
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `tickets/${listingId}/${timestamp}_${safeFilename}`;

    // Upload to real AWS S3
    await this.s3.upload(s3Key, file.buffer, file.mimetype);

    this.logger.log(`[S3] Ticket uploaded for listing ${listingId}: ${s3Key}`);

    // Upsert the TicketUpload record with the S3 key
    const ticketUpload = await this.prisma.ticketUpload.upsert({
      where: { listingId },
      update: {
        filePath: s3Key,
        fileSize: file.size,
        mimeType: file.mimetype,
        watermarkApplied: false,
      },
      create: {
        listingId,
        filePath: s3Key,
        fileSize: file.size,
        mimeType: file.mimetype,
        watermarkApplied: false,
      },
    });

    return {
      message: "Ticket file successfully uploaded to S3 and secured. Pending Admin approval.",
      ticketId: ticketUpload.id,
      s3Key,
    };
  }

  // Reveal fully scannable ticket: generates a pre-signed S3 URL + security watermark stamp
  async revealTicket(
    userId: string,
    listingId: string,
    deviceInfo: string,
    ipAddress: string,
    actionType: AccessAction = AccessAction.VIEW
  ) {
    // 1. Fetch listing and secure ticket attachment
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        ticketUpload: true,
        orders: {
          where: { buyerId: userId },
          include: { buyer: true },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException("Listing not found.");
    }

    if (!listing.ticketUpload) {
      throw new NotFoundException("Ticket file has not been uploaded by the seller yet.");
    }

    // 2. Validate user is the actual buyer
    const userOrder = listing.orders[0];
    if (!userOrder) {
      throw new ForbiddenException(
        "Access Denied: Barcode is masked. Purchase the ticket to unlock scannable details."
      );
    }

    // 3. Validate payment is fully confirmed
    if (
      userOrder.status !== OrderStatus.PAID &&
      userOrder.status !== OrderStatus.DISPUTED &&
      userOrder.status !== OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Access Denied: Ticket is locked. Order status is currently ${userOrder.status}.`
      );
    }

    // 4. Log ticket access details (device, IP, action type)
    await this.prisma.accessLog.create({
      data: {
        ticketUploadId: listing.ticketUpload.id,
        userId,
        deviceInfo: deviceInfo || "Unknown Device",
        ipAddress: ipAddress || "127.0.0.1",
        actionType,
      },
    });

    // Count download events for audit trail
    const accessCount = await this.prisma.accessLog.count({
      where: {
        ticketUploadId: listing.ticketUpload.id,
        actionType: AccessAction.DOWNLOAD,
      },
    });

    // 5. Generate dynamic watermark text
    const watermarkText = `SECURED BY BLACKTICKET | BUYER: ${userOrder.buyer.name.toUpperCase()} | TRANSACTION ID: ${userOrder.id.slice(-8).toUpperCase()} | OPEN COUNT: ${accessCount + 1} | GATE INTEL VALIDATED`;

    this.logger.log(
      `🔓 Revealing ticket for Listing ${listingId} to Buyer ${userOrder.buyer.name} (${userId}). Access #${accessCount + 1}`
    );

    // 6. Generate a 1-hour pre-signed S3 download URL
    const signedUrl = await this.s3.getSignedDownloadUrl(
      listing.ticketUpload.filePath,
      3600 // 1 hour validity
    );

    return {
      success: true,
      ticket: {
        fileName: listing.ticketUpload.filePath.split("/").pop(),
        signedUrl,          // ← Pre-signed S3 link valid for 1 hour
        mimeType: listing.ticketUpload.mimeType,
        unlockedAt: new Date().toISOString(),
      },
      security: {
        watermarkApplied: true,
        watermarkText,
        accessCount: accessCount + 1,
        downloadTrackingActive: true,
      },
    };
  }
}
