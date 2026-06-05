import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Advance } from './entities/advance.entity';
import { AdvanceService } from './advance.service';
import { AdvanceController } from './advance.controller';
import { WalletModule } from '../wallet/wallet.module';
import { MerchantModule } from '../merchant/merchant.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Advance]),
    WalletModule,
    MerchantModule,
    TransactionModule,
  ],
  controllers: [AdvanceController],
  providers: [AdvanceService],
  exports: [AdvanceService],
})
export class AdvanceModule {}
