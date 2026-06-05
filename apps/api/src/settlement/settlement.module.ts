import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transaction/entities/transaction.entity';
import { SettlementService } from './settlement.service';
import { AdvanceModule } from '../advance/advance.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    AdvanceModule,
    TransactionModule,
  ],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
