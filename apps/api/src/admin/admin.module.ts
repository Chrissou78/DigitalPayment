import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Advance } from '../advance/entities/advance.entity';
import { Refill } from '../refill/entities/refill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Merchant, Advance, Refill])],
  controllers: [AdminController],
})
export class AdminModule {}
