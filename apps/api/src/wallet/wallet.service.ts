import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerEntryType } from '@payduka/shared';
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
    const wallet = this.walletRepo.create({ ownerId: merchantId, ownerType: 'MERCHANT' });
    return this.walletRepo.save(wallet);
  }

  async findByMerchantId(merchantId: string): Promise<Wallet> {
    return this.walletRepo.findOneOrFail({ where: { ownerId: merchantId, ownerType: 'MERCHANT' } });
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
    referenceType: string | null,
    referenceId: string | null,
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

    if (wallet.available < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.available = Number(wallet.available) - amount;
    await qr.manager.save(wallet);

    const entry = qr.manager.create(LedgerEntry, {
      walletId,
      type,
      amount: -amount,
      balanceAfter: wallet.available,
      referenceType,
      referenceId,
      description,
    });
    return qr.manager.save(entry);
  }

  async credit(
    qr: QueryRunner,
    walletId: string,
    amount: number,
    type: LedgerEntryType,
    referenceType: string | null,
    referenceId: string | null,
    description: string,
  ): Promise<LedgerEntry> {
    const wallet = await qr.manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet || wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('Wallet not available');
    }

    if (type === LedgerEntryType.RESERVE_HOLD) {
      wallet.reserved = Number(wallet.reserved) + amount;
    } else {
      wallet.available = Number(wallet.available) + amount;
    }

    await qr.manager.save(wallet);

    const entry = qr.manager.create(LedgerEntry, {
      walletId,
      type,
      amount: +amount,
      balanceAfter:
        type === LedgerEntryType.RESERVE_HOLD
          ? wallet.reserved
          : wallet.available,
      referenceType,
      referenceId,
      description,
    });
    return qr.manager.save(entry);
  }

  async getBalance(
    walletId: string,
  ): Promise<{ available: number; reserved: number; staked: number; currency: string }> {
    const w = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!w) {
      throw new BadRequestException('Wallet not found');
    }
    return {
      available: Number(w.available),
      reserved: Number(w.reserved),
      staked: Number(w.staked),
      currency: w.currency,
    };
  }
}
