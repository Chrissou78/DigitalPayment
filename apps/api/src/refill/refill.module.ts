import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Refill } from './entities/refill.entity';
import { RefillService } from './refill.service';
import { RefillProcessor } from './refill.processor';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentRailModule } from '../payment-rail/payment-rail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Refill]),
    BullModule.registerQueue({ name: 'refill' }),
    WalletModule,
    PaymentRailModule,
  ],
  providers: [RefillService, RefillProcessor],
  exports: [RefillService],
})
export class RefillModule {}
