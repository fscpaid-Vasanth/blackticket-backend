import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { WalletModule } from "../wallet/wallet.module";
import { DisputesModule } from "../disputes/disputes.module";

@Module({
  imports: [WalletModule, DisputesModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
