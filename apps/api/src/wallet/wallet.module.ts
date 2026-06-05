import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { WalletService } from './wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, LedgerEntry])],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
