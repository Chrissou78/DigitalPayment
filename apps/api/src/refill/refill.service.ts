import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

import { Refill } from './entities/refill.entity';
import { RefillStatus } from '../common/enums/refill-status.enum';
import { WalletService } from '../wallet/wallet.service';
import { PaymentRailService } from '../payment-rail/payment-rail.service';

@Injectable()
export class RefillService {
  private readonly logger = new Logger(RefillService.name);
  private readonly redis: Redis;

  constructor(
    @InjectRepository(Refill)
    private readonly refillRepo: Repository<Refill>,
    @InjectQueue('refill')
    private readonly refillQueue: Queue,
    private readonly walletService: WalletService,
    private readonly paymentRail: PaymentRailService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis({
      host: config.get('REDIS_HOST'),
      port: config.get<number>('REDIS_PORT'),
    });
  }

  /**
   * Listen for completed transactions and check if refill is needed
   */
  @OnEvent('txn.completed')
  async onTransactionCompleted(payload: {
    customerWalletId?: string;
    merchantWalletId: string;
  }) {
    // Check both wallets
    for (const walletId of [payload.customerWalletId, payload.merchantWalletId]) {
      if (!walletId) continue;
      await this.checkAndQueue(walletId);
    }
  }

  async checkAndQueue(walletId: string): Promise<void> {
    const balance = await this.walletService.getBalance(walletId);
    const threshold = this.config.get<number>('REFILL_DEFAULT_THRESHOLD', 50000);

    if (balance.available < threshold) {
      this.logger.log(
        `Wallet ${walletId} below threshold: R${(balance.available / 100).toFixed(2)} ` +
        `< R${(threshold / 100).toFixed(2)}. Queuing refill.`,
      );

      await this.refillQueue.add(
        'process-refill',
        { walletId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }
  }

  async processRefill(walletId: string): Promise<Refill | null> {
    const lockKey = `wallet:${walletId}:refill`;
    const lockTTL = 300; // 5 minutes

    // 1. Acquire distributed lock
    const locked = await this.redis.set(lockKey, '1', 'EX', lockTTL, 'NX');
    if (!locked) {
      this.logger.warn(`Refill lock already held for wallet ${walletId}`);
      return null;
    }

    try {
      // 2. Re-check balance (might have changed since queue time)
      const balance = await this.walletService.getBalance(walletId);
      const threshold = this.config.get<number>('REFILL_DEFAULT_THRESHOLD', 50000);
      if (balance.available >= threshold) {
        this.logger.log(`Wallet ${walletId} balance recovered. Skipping refill.`);
        return null;
      }

      // 3. Check no in-flight refill
      const inflight = await this.refillRepo.count({
        where: { walletId, status: RefillStatus.PENDING_PAYMENT },
      });
      if (inflight > 0) {
        this.logger.warn(`In-flight refill exists for wallet ${walletId}`);
        return null;
      }

      // 4. Create refill record
      const refillAmount = this.config.get<number>('REFILL_DEFAULT_AMOUNT', 100000);
      const refill = this.refillRepo.create({
        walletId,
        amount: refillAmount,
        status: RefillStatus.INITIATED,
      });
      const saved = await this.refillRepo.save(refill);

      // 5. Initiate payment pull via Stitch
      const payment = await this.paymentRail.initiateRefillPull({
        amountCents: refillAmount,
        walletId,
        refillId: saved.id,
        bankAccountId: 'linked-bank-account', // TODO: get from wallet entity
      });

      // 6. Update to PENDING_PAYMENT
      saved.status = RefillStatus.PENDING_PAYMENT;
      saved.externalPaymentId = payment.id;
      saved.externalPaymentUrl = payment.url;
      await this.refillRepo.save(saved);

      this.logger.log(
        `Refill ${saved.id} initiated for wallet ${walletId}: ` +
        `R${(refillAmount / 100).toFixed(2)}, paymentId=${payment.id}`,
      );

      return saved;
    } catch (error) {
      this.logger.error(`Refill failed for wallet ${walletId}: ${error.message}`);

      // Mark as failed if record was created
      const failed = await this.refillRepo.findOne({
        where: { walletId, status: RefillStatus.INITIATED },
        order: { createdAt: 'DESC' },
      });
      if (failed) {
        failed.status = RefillStatus.FAILED;
        await this.refillRepo.save(failed);
      }
      throw error;
    } finally {
      // 7. Release lock
      await this.redis.del(lockKey);
    }
  }

  async completeRefill(externalPaymentId: string): Promise<void> {
    const refill = await this.refillRepo.findOne({
      where: { externalPaymentId, status: RefillStatus.PENDING_PAYMENT },
    });

    if (!refill) {
      this.logger.warn(`No pending refill found for payment ${externalPaymentId}`);
      return;
    }

    // 9. Credit the wallet
    const queryRunner = this.refillRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { LedgerEntryType } = await import('../common/enums/ledger-entry-type.enum');

      await this.walletService.credit(
        queryRunner,
        refill.walletId,
        refill.amount,
        LedgerEntryType.REFILL,
        refill.id,
        `Wallet refill: R${(refill.amount / 100).toFixed(2)}`,
      );

      // 10. Mark completed
      refill.status = RefillStatus.COMPLETED;
      refill.completedAt = new Date();
      await queryRunner.manager.save(refill);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Refill ${refill.id} completed: R${(refill.amount / 100).toFixed(2)} ` +
        `credited to wallet ${refill.walletId}`,
      );

      // 11. TODO: Send push notification + SMS
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
