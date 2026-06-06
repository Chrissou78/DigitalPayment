import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

import { Transaction } from './entities/transaction.entity';
import { TransactionEvent } from './entities/transaction-event.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionStatus } from '../common/enums/transaction-status.enum';
import { TransactionType } from '../common/enums/transaction-type.enum';
import { LedgerEntryType, LedgerReferenceType } from '@payduka/shared';

import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletService } from '../wallet/wallet.service';
import { FraudService } from '../fraud/fraud.service';
import { PaymentRailService } from '../payment-rail/payment-rail.service';
import { MerchantService } from '../merchant/merchant.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    @Optional()
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
   * QR / wallet-to-wallet payment: debit the customer, credit the merchant net
   * of fee, atomically.
   */
  async createPayment(params: {
    merchantId: string;
    customerId: string;
    amount: number;
    qrPayload?: string;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Wallet, {
        where: { ownerId: params.customerId },
      });
      const merchant = await manager.findOne(Wallet, {
        where: { ownerId: params.merchantId },
      });

      if (!customer || !merchant) {
        throw new BadRequestException('Wallet not found');
      }
      if (Number(customer.available) < params.amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const feePercent = this.config.get<number>('rules.transactionFeePercent', 1.5);
      const fee = Math.round(params.amount * (feePercent / 100));
      const merchantCredit = params.amount - fee;

      customer.available = Number(customer.available) - params.amount;
      merchant.available = Number(merchant.available) + merchantCredit;
      await manager.save(customer);
      await manager.save(merchant);

      const txn = manager.create(Transaction, {
        merchantId: params.merchantId,
        type: TransactionType.QR,
        amount: params.amount,
        fee,
        status: TransactionStatus.COMPLETED,
      });
      return manager.save(txn);
    });
  }

  async create(dto: CreateTransactionDto) {
    const feePercent = this.config.get<number>('PAYDUKA_FEE_PERCENT', 1.5);
    const reservePercent = this.config.get<number>('MERCHANT_RESERVE_PERCENT', 5);

    // ── 1. Card authorization (if card transaction) ──
    let authCode: string | undefined;
    if (dto.type === TransactionType.CARD && dto.cardToken) {
      const auth = await this.paymentRail.authorizeCard({
        token: dto.cardToken,
        amount: dto.amount,
      });
      if (!auth.authorized) throw new BadRequestException('Card authorization failed');
      authCode = auth.authCode;
    }

    // ── 2. Fraud check ──
    const fraud = await this.fraudService.score({
      merchantId: dto.merchantId,
      customerId: dto.customerWalletId,
      amount: dto.amount,
      type: dto.type,
      metadata: dto.metadata,
    });
    if (!fraud.pass) {
      throw new BadRequestException('Transaction declined by fraud check');
    }

    // ── 3. Calculate amounts ──
    const fee = Math.round(dto.amount * (feePercent / 100));
    const reserve = Math.round(dto.amount * (reservePercent / 100));
    const merchantCredit = dto.amount - fee;

    // ── 4. Atomic DB transaction ──
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const merchant = await this.merchantService.findById(dto.merchantId);
      const merchantWallet = await this.walletService.findByMerchantId(dto.merchantId);

      // Create transaction record
      const txn = queryRunner.manager.create(Transaction, {
        type: dto.type,
        status: dto.type === TransactionType.CARD
          ? TransactionStatus.AUTHORIZED
          : TransactionStatus.COMPLETED,
        merchantId: dto.merchantId,
        customerWalletId: dto.customerWalletId,
        merchantWalletId: merchantWallet.id,
        amount: dto.amount,
        fee,
        reserveAmount: reserve,
        authCode,
        metadata: { ...dto.metadata, fraud },
      });
      const savedTxn = await queryRunner.manager.save(txn);

      // Debit customer wallet (if QR/wallet payment)
      if (dto.customerWalletId) {
        await this.walletService.debit(
          queryRunner,
          dto.customerWalletId,
          dto.amount,
          LedgerEntryType.DEBIT,
          LedgerReferenceType.PAYMENT,
          savedTxn.id,
          `Payment to ${merchant.businessName}`,
        );
      }

      // Credit merchant wallet (available - fee)
      await this.walletService.credit(
        queryRunner,
        merchantWallet.id,
        merchantCredit - reserve,
        LedgerEntryType.CREDIT,
        LedgerReferenceType.PAYMENT,
        savedTxn.id,
        `Sale received (net of fee)`,
      );

      // Credit merchant reserve
      await this.walletService.credit(
        queryRunner,
        merchantWallet.id,
        reserve,
        LedgerEntryType.RESERVE_HOLD,
        LedgerReferenceType.PAYMENT,
        savedTxn.id,
        `Rolling reserve (${reservePercent}%)`,
      );

      // Credit PayDuka fee revenue (system wallet)
      // In production this would go to a dedicated revenue wallet
      // For now we log it as a ledger entry on the merchant wallet
      await this.walletService.credit(
        queryRunner,
        merchantWallet.id,
        0, // fee is already deducted
        LedgerEntryType.FEE_REVENUE,
        LedgerReferenceType.FEE,
        savedTxn.id,
        `PayDuka fee: R${(fee / 100).toFixed(2)}`,
      );

      // Create events
      const createdEvent = queryRunner.manager.create(TransactionEvent, {
        transactionId: savedTxn.id,
        status: TransactionStatus.CREATED,
        data: { amount: dto.amount, type: dto.type },
      });
      await queryRunner.manager.save(createdEvent);

      const completedEvent = queryRunner.manager.create(TransactionEvent, {
        transactionId: savedTxn.id,
        status: savedTxn.status,
        data: { fee, reserve, merchantCredit: merchantCredit - reserve },
      });
      await queryRunner.manager.save(completedEvent);

      // Commit
      await queryRunner.commitTransaction();

      this.logger.log(
        `Transaction ${savedTxn.id} completed: R${(dto.amount / 100).toFixed(2)} ` +
        `fee=R${(fee / 100).toFixed(2)} reserve=R${(reserve / 100).toFixed(2)}`,
      );

      // ── 5. Async post-processing ──
      this.emitter.emit('txn.completed', {
        transactionId: savedTxn.id,
        merchantId: dto.merchantId,
        merchantWalletId: merchantWallet.id,
        customerWalletId: dto.customerWalletId,
        amount: dto.amount,
        fee,
        type: dto.type,
      });

      // Update trailing volume
      await this.merchantService.updateVolume(dto.merchantId, dto.amount);

      return {
        txnId: savedTxn.id,
        status: savedTxn.status,
        amount: dto.amount,
        fee,
        reserve,
        merchantCredited: merchantCredit - reserve,
        newBalance: (await this.walletService.getBalance(merchantWallet.id)).available,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<Transaction> {
    return this.txnRepo.findOneOrFail({
      where: { id },
      relations: ['events'],
    });
  }

  async settleCardTransaction(txnId: string, settledAmount: number): Promise<Transaction> {
    const txn = await this.txnRepo.findOneOrFail({ where: { id: txnId } });
    txn.status = TransactionStatus.SETTLED;
    return this.txnRepo.save(txn);
  }
}
