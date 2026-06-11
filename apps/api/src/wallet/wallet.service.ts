// apps/api/src/wallet/wallet.service.ts
import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryRunner, DataSource } from "typeorm";
import { Wallet } from "./entities/wallet.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { LedgerEntryType, LedgerReferenceType } from "@payduka/shared";

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    private readonly dataSource: DataSource,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
  ) {}

  async createForMerchant(merchantId: string): Promise<Wallet> {
    const wallet = this.walletRepo.create({
      ownerId: merchantId,
      ownerType: "MERCHANT",
    });
    return this.walletRepo.save(wallet);
  }

  async getBalance(walletId: string) {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) throw new BadRequestException("Wallet not found");
    return {
      available: wallet.available,
      reserved: wallet.reserved,
      staked: wallet.staked,
    };
  }

  async credit(
    queryRunner: QueryRunner,
    walletId: string,
    amount: number,
    type: LedgerEntryType,
    referenceType: LedgerReferenceType,
    referenceId: string,
    description: string,
  ): Promise<void> {
    const wallet = await queryRunner.manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: "pessimistic_write" },
    });
    if (!wallet) throw new BadRequestException("Wallet not found");

    wallet.available += amount;
    await queryRunner.manager.save(wallet);

    await queryRunner.manager.save(LedgerEntry, {
      walletId,
      type,
      referenceType,
      amount,
      balanceAfter: wallet.available,
      transactionId: referenceId,
      description,
    });
  }

  async debit(
    queryRunner: QueryRunner,
    walletId: string,
    amount: number,
    type: LedgerEntryType,
    referenceType: LedgerReferenceType,
    referenceId: string,
    description: string,
  ): Promise<void> {
    const wallet = await queryRunner.manager.findOne(Wallet, {
      where: { id: walletId },
      lock: { mode: "pessimistic_write" },
    });
    if (!wallet) throw new BadRequestException("Wallet not found");

    if (wallet.available < amount) {
      throw new BadRequestException("Insufficient balance");
    }

    wallet.available -= amount;
    await queryRunner.manager.save(wallet);

    await queryRunner.manager.save(LedgerEntry, {
      walletId,
      type,
      referenceType,
      amount: -amount,
      balanceAfter: wallet.available,
      transactionId: referenceId,
      description,
    });
  }

  async findByPhone(phone: string): Promise<Wallet> {
  // Look up customer by phone, then find their wallet
  const customer = await this.dataSource.getRepository("Customer")
    .findOne({ where: { phone } });
  if (!customer) throw new BadRequestException("Customer not found");
  const wallet = await this.walletRepo.findOne({
    where: { ownerId: (customer as any).id, ownerType: "CUSTOMER" },
  });
  if (!wallet) throw new BadRequestException("Customer wallet not found");
  return wallet;
}

  async findByOwnerId(ownerId: string): Promise<Wallet | null> {
    return this.walletRepo.findOne({ where: { ownerId } });
  }

  async findByMerchantId(merchantId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { ownerId: merchantId, ownerType: "MERCHANT" },
    });
    if (!wallet) throw new BadRequestException("Merchant wallet not found");
    return wallet;
  }
}
