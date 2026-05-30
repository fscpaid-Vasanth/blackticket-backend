import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { EscrowService } from "./escrow.service";
import { EscrowProcessor } from "./escrow.processor";
import { ExpiredListingsCron } from "./expired-listings.cron";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: "escrow",
    }),
  ],
  providers: [EscrowService, EscrowProcessor, ExpiredListingsCron],
  exports: [EscrowService],
})
export class EscrowModule {}
