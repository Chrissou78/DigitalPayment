import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashIn } from './entities/cash-in.entity';
import { CashInService } from './cash-in.service';
import { CashInController } from './cash-in.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([CashIn]), WalletModule],
  controllers: [CashInController],
  providers: [CashInService],
  exports: [CashInService],
})
export class CashInModule {}
