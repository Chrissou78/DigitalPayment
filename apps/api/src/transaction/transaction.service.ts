import { Injectable, BadRequestException, Logger, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";

import { Transaction } from "./entities/transaction.entity";
import { TransactionEvent } from "./entities/transaction-event.entity";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { LedgerEntryType, LedgerReferenceType } from "@payduka/shared";

import { Wallet } from "../wallet/entities/wallet.entity";
import { WalletService } from "../wallet/wallet.service";
import { FraudService } from "../fraud/fraud.service";
import { PaymentRailService } from "../payment-rail/payment-rail.service";
import { MerchantService } from "../merchant/merchant.service";

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    @InjectRepository(TransactionEvent)
    private readonly eventRepo: Repository<TransactionEvent>,
    private readonly dataSource: DataSource,
    @Optional() private readonly walletService: WalletService,
    private readonly fraudService: FraudService,
    private readonly paymentRail: PaymentRailService,
    @Optional() private readonly merchantService: MerchantService,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /**
   * QR / wallet-to-wallet payment: debit the customer, credit the merchant
   * net of fee, atomically.
   */
  async createPayment(params: {
    merchantId: string;
    customerId: string;
    amount: number;
    qrPayload?: string;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const customerWallet = await manager.findOne(Wallet, {
        where: { ownerId: params.customerId },
      });
      const merchantWallet = await manager.findOne(Wallet, {
        where: { ownerId: params.merchantId },
      });

      if (!customerWallet || !merchantWallet) {
        throw new BadRequestException("Wallet not found");
      }
      if (Number(customerWallet.available) < params.amount) {
        throw new BadRequestException("Insufficient balance");
      }

      const feePercent = this.config.get<number>("rules.transactionFeePercent", 1.5);
      const fee = Math.round(params.amount * (feePercent / 100));
      const merchantCredit = params.amount - fee;

      customerWallet.available = Number(customerWallet.available) - params.amount;
      merchantWallet.available = Number(merchantWallet.available) + merchantCredit;
      await manager.save(customerWallet);
      await manager.save(merchantWallet);

      const txn = manager.create(Transaction, {
        merchantId: params.merchantId,
        customerId: params.customerId,
        type: "PAYMENT",
        amount: params.amount,
        fee,
        qrPayload: params.qrPayload,
        status: "COMPLETED",
      });
      return manager.save(txn);
    });
  }

  /**
   * General transaction creation — used by the POST /transactions endpoint.
   */
  async create(dto: CreateTransactionDto) {
    const feePercent = this.config.get<number>("rules.transactionFeePercent", 1.5);
    const reservePercent = this.config.get<number>("rules.merchantReservePercent", 5);

    // ── 1. Fraud check ──
    const fraud = await this.fraudService.score({
      merchantId: dto.merchantId,
      customerId: dto.customerId,
      amount: dto.amount,
      type: dto.type,
      metadata: dto.metadata,
    });
    if (!fraud.pass) {
      throw new BadRequestException("Transaction declined by fraud check");
    }

    // ── 2. Calculate amounts ──
    const fee = Math.round(dto.amount * (feePercent / 100));
    const reserve = Math.round(dto.amount * (reservePercent / 100));
    const merchantCredit = dto.amount - fee;

    // ── 3. Atomic DB transaction ──
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction("SERIALIZABLE");

    let savedTxn: Transaction;
    let merchantWalletId: string;

    try {
      const merchant = await this.merchantService.findById(dto.merchantId);
      const merchantWallet = await this.walletService.findByMerchantId(dto.merchantId);
      merchantWalletId = merchantWallet.id;

      // Create transaction record
      const txn = queryRunner.manager.create(Transaction, {
        type: dto.type,
        status: "COMPLETED",
        merchantId: dto.merchantId,
        customerId: dto.customerId,
        amount: dto.amount,
        fee,
        reserveAmount: reserve,
        customerRef: dto.customerRef,
        merchantRef: dto.merchantRef,
        metadata: { ...dto.metadata, fraud },
      });
      savedTxn = await queryRunner.manager.save(txn);

      // Debit customer wallet (if customer provided)
      if (dto.customerId) {
        const customerWallet = await this.walletService.findByOwnerId(dto.customerId);
        if (customerWallet) {
          await this.walletService.debit(
            queryRunner,
            customerWallet.id,
            dto.amount,
            LedgerEntryType.DEBIT,
            LedgerReferenceType.PAYMENT,
            savedTxn.id,
            `Payment to ${merchant.businessName}`,
          );
        }
      }

      // Credit merchant wallet (available - fee - reserve)
      await this.walletService.credit(
        queryRunner,
        merchantWallet.id,
        merchantCredit - reserve,
        LedgerEntryType.CREDIT,
        LedgerReferenceType.PAYMENT,
        savedTxn.id,
        "Sale received (net of fee)",
      );

      // Hold merchant reserve
      await this.walletService.credit(
        queryRunner,
        merchantWallet.id,
        reserve,
        LedgerEntryType.RESERVE_HOLD,
        LedgerReferenceType.PAYMENT,
        savedTxn.id,
        `Rolling reserve (${reservePercent}%)`,
      );

      // Create events
      const createdEvent = queryRunner.manager.create(TransactionEvent, {
        transactionId: savedTxn.id,
        event: "CREATED",
        data: { amount: dto.amount, type: dto.type },
      });
      await queryRunner.manager.save(createdEvent);

      const completedEvent = queryRunner.manager.create(TransactionEvent, {
        transactionId: savedTxn.id,
        event: "COMPLETED",
        data: { fee, reserve, merchantCredit: merchantCredit - reserve },
      });
      await queryRunner.manager.save(completedEvent);

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Transaction failed: ${err.message}`, err.stack);
      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }

    // ── 4. Post-processing (outside the DB transaction) ──
    this.logger.log(
      `Transaction ${savedTxn.id} completed: R${(dto.amount / 100).toFixed(2)} ` +
        `fee=R${(fee / 100).toFixed(2)} reserve=R${(reserve / 100).toFixed(2)}`,
    );

    this.emitter.emit("txn.completed", {
      transactionId: savedTxn.id,
      merchantId: dto.merchantId,
      amount: dto.amount,
      fee,
      type: dto.type,
    });

    try {
      await this.merchantService.updateVolume(dto.merchantId, dto.amount);
    } catch (e) {
      this.logger.warn(`Failed to update volume: ${e}`);
    }

    const balance = await this.walletService.getBalance(merchantWalletId);

    return {
      txnId: savedTxn.id,
      status: savedTxn.status,
      amount: dto.amount,
      fee,
      reserve,
      merchantCredited: merchantCredit - reserve,
      newBalance: balance.available,
    };
  }


  async findById(id: string): Promise<Transaction> {
    return this.txnRepo.findOneOrFail({
      where: { id },
      relations: ["events"],
    });
  }

  async settleCardTransaction(txnId: string, settledAmount: number): Promise<Transaction> {
    const txn = await this.txnRepo.findOneOrFail({ where: { id: txnId } });
    txn.status = "SETTLED";
    return this.txnRepo.save(txn);
  }
}
