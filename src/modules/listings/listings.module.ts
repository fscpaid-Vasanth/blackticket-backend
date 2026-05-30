import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ListingsService } from "./listings.service";
import { ListingsController } from "./listings.controller";

@Module({
  imports: [ConfigModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
