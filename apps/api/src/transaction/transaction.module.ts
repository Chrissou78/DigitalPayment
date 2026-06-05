import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionEvent } from './entities/transaction-event.entity';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { WalletModule } from '../wallet/wallet.module';
import { FraudModule } from '../fraud/fraud.module';
import { PaymentRailModule } from '../payment-rail/payment-rail.module';
import { MerchantModule } from '../merchant/merchant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionEvent]),
    WalletModule,
    FraudModule,
    PaymentRailModule,
    MerchantModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
