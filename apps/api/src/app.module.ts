import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import configuration from './config/configuration';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { MerchantModule } from './merchant/merchant.module';
import { CustomerModule } from './customer/customer.module';
import { WalletModule } from './wallet/wallet.module';
import { TransactionModule } from './transaction/transaction.module';
import { CashInModule } from './cash-in/cash-in.module';
import { RemittanceModule } from './remittance/remittance.module';
import { FraudModule } from './fraud/fraud.module';
import { PaymentRailModule } from './payment-rail/payment-rail.module';
import { AdvanceModule } from './advance/advance.module';
import { RefillModule } from './refill/refill.module';
import { StakingModule } from './staking/staking.module';
import { SettlementModule } from './settlement/settlement.module';
import { WebhookModule } from './webhook/webhook.module';
import { NotificationModule } from './notification/notification.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // ── Config ──
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // ── Database ──
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbConfig = config.get("database");
        if (!dbConfig) throw new Error("Database configuration is missing");
        return dbConfig;
      },
    }),

    // ── Redis + Queues ──
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisConfig = config.get("redis");
        if (!redisConfig) throw new Error("Redis configuration is missing");
        return { connection: redisConfig };
      },
    }),

    // ── Events ──
    EventEmitterModule.forRoot(),

    // ── Cron / Scheduling ──
    ScheduleModule.forRoot(),

    // ── Feature Modules ──
    AuthModule,
    MerchantModule,
    CustomerModule,
    WalletModule,
    TransactionModule,
    CashInModule,
    RemittanceModule,
    FraudModule,
    PaymentRailModule,
    AdvanceModule,
    RefillModule,
    StakingModule,
    SettlementModule,
    WebhookModule,
    NotificationModule,
    AdminModule,
  ],
})
export class AppModule {}
