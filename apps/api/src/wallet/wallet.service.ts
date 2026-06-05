import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerEntryType } from '../common/enums/ledger-entry-type.enum';
import { WalletStatus } from '../common/enums/wallet-status.enum';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async createForMerchant(merchantId: string): Promise<Wallet> {
    const wallet = this.walletRepo.create({ merchantId });
    return this.walletRepo.save(wallet);
  }

  async findByMerchantId(merchantId: string): Promise<Wallet> {
    return this.walletRepo.findOneOrFail({ where: { merchantId } });
  }

  /**
   * Atomic debit + credit within a QueryRunner transaction.
   * Called by TransactionService inside its own BEGIN/COMMIT block.
   */
  async debit(
    qr: QueryRunner,
    walletId: string,
    amount: number,
    type: LedgerEntryType,
    transactionId: string,
    description: string,
  ): Promise<LedgerEntry> {
    // Lock the wallet row
    const wallet = await qr.manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet || wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('Wallet not available');
    }

    if (wallet.availableBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.availableBalance = Number(wallet.availableBalance) - amount;
    await qr.manager.save(wallet);

    const entry = qr.manager.create(LedgerEntry, {
      walletId,
      type,
      amount: -amount,
      balanceAfter: wallet.availableBalance,
      transactionId,
      description,
    });
    return qr.manager.save(entry);
  }

  async credit(
    qr: QueryRunner,
    walletId: string,
    amount: number,
    type: LedgerEntryType,
    transactionId: string,
    description: string,
  ): Promise<LedgerEntry> {
    const wallet = await qr.manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet || wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('Wallet not available');
    }

    if (type === LedgerEntryType.RESERVED) {
      wallet.reservedBalance = Number(wallet.reservedBalance) + amount;
    } else {
      wallet.availableBalance = Number(wallet.availableBalance) + amount;
    }

    await qr.manager.save(wallet);

    const entry = qr.manager.create(LedgerEntry, {
      walletId,
      type,
      amount: +amount,
      balanceAfter:
        type === LedgerEntryType.RESERVED
          ? wallet.reservedBalance
          : wallet.availableBalance,
      transactionId,
      description,
    });
    return qr.manager.save(entry);
  }

  async getBalance(walletId: string): Promise<{ available: number; reserved: number }> {
    const w = await this.walletRepo.findOneOrFail({ where: { id: walletId } });
    return { available: Number(w.availableBalance), reserved: Number(w.reservedBalance) };
  }
}
