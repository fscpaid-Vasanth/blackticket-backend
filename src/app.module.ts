import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import configuration from "./config/configuration";

// Core and Database
import { PrismaModule } from "./database/prisma.module";
import { S3Module } from "./config/s3.module";

// Custom Feature Modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ListingsModule } from "./modules/listings/listings.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { EscrowModule } from "./modules/escrow/escrow.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { DisputesModule } from "./modules/disputes/disputes.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    // Global Config mapping Environment Variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Global Rate Limiting Throttler
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // Max 100 requests per minute
      },
    ]),

    // BullMQ Redis Connection Broker
    // Auto-detects Upstash TLS (REDIS_URL=rediss://...) vs local Docker (REDIS_HOST/PORT)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("redis.url");

        if (redisUrl) {
          // Parse the full rediss:// or redis:// URL (Upstash / Redis Cloud)
          const parsed = new URL(redisUrl);
          const isTls = parsed.protocol === "rediss:";
          return {
            connection: {
              host: parsed.hostname,
              port: parseInt(parsed.port, 10) || 6379,
              username: parsed.username || "default",
              password: decodeURIComponent(parsed.password),
              ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
            },
          };
        }

        // Local Docker fallback
        return {
          connection: {
            host: configService.get<string>("redis.host"),
            port: configService.get<number>("redis.port"),
          },
        };
      },
    }),

    // Global DB context
    ScheduleModule.forRoot(),
    PrismaModule,
    S3Module,

    // Feature modules wireframes
    AuthModule,
    UsersModule,
    ListingsModule,
    TicketsModule,
    OrdersModule,
    PaymentsModule,
    EscrowModule,
    WalletModule,
    DisputesModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule {}
