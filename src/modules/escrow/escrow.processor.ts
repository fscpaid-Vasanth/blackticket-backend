import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { EscrowService } from "./escrow.service";
import { PrismaService } from "../../database/prisma.service";

@Processor("escrow")
export class EscrowProcessor extends WorkerHost {
  constructor(
    private readonly escrowService: EscrowService,
    private readonly prisma: PrismaService
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case "release-escrow": {
        const { orderId } = job.data;
        console.log(`[BULLMQ-WORKER] Processing delayed escrow release for order #${orderId}`);
        try {
          await this.escrowService.releaseEscrow(orderId);
        } catch (error) {
          console.error(`[BULLMQ-WORKER] Escrow release job failed for order #${orderId}: ${error.message}`);
          throw error;
        }
        break;
      }

      case "cleanup-expired": {
        console.log("[BULLMQ-WORKER] Running showtime expired listings cleanup...");
        try {
          const now = new Date();
          const expiredListings = await this.prisma.listing.updateMany({
            where: {
              status: "ACTIVE",
              showtime: { lte: now },
            },
            data: {
              status: "EXPIRED",
            },
          });
          console.log(`[BULLMQ-WORKER] Successfully expired ${expiredListings.count} listings.`);
        } catch (error) {
          console.error(`[BULLMQ-WORKER] Expired listings cleanup failed: ${error.message}`);
          throw error;
        }
        break;
      }

      default:
        console.warn(`[BULLMQ-WORKER] Unknown job name received: ${job.name}`);
    }
  }
}
