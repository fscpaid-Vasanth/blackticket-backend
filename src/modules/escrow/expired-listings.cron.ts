import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../database/prisma.service";
import { ListingStatus } from "@prisma/client";

@Injectable()
export class ExpiredListingsCron {
  private readonly logger = new Logger(ExpiredListingsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs every 15 minutes — marks any ACTIVE listing whose showtime has passed as EXPIRED
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredListings() {
    this.logger.log("[CRON] Scanning for expired showtime listings...");

    try {
      const now = new Date();

      const result = await this.prisma.listing.updateMany({
        where: {
          status: ListingStatus.ACTIVE,
          showtime: { lte: now },
        },
        data: {
          status: ListingStatus.EXPIRED,
        },
      });

      if (result.count > 0) {
        this.logger.log(`[CRON] Expired ${result.count} listing(s) past their showtime.`);
      } else {
        this.logger.debug("[CRON] No expired listings found in this pass.");
      }
    } catch (error) {
      this.logger.error(`[CRON] Expired listings cleanup failed: ${error.message}`);
    }
  }
}
