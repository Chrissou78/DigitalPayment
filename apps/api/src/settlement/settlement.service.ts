import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transaction/entities/transaction.entity';
import { TransactionStatus } from '../common/enums/transaction-status.enum';
import { TransactionType } from '../common/enums/transaction-type.enum';
import { AdvanceService } from '../advance/advance.service';
import { TransactionService } from '../transaction/transaction.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    private readonly advanceService: AdvanceService,
    private readonly txnService: TransactionService,
  ) {}

  /**
   * Process card settlement webhooks.
   * Called by WebhookModule when Stitch/card network confirms settlement.
   */
  async processCardSettlement(
    externalPaymentId: string,
    settledAmount: number,
  ): Promise<void> {
    // Find the original transaction
    const txn = await this.txnRepo.findOne({
      where: { merchantRef: externalPaymentId, type: "PAYMENT" },
    });

    if (!txn) {
      this.logger.warn(`No card txn found for payment ${externalPaymentId}`);
      return;
    }

    // Settle any outstanding advance first
    await this.advanceService.settleFromCardSettlement(txn.id, settledAmount);

    // Update transaction status
    await this.txnService.settleCardTransaction(txn.id, settledAmount);

    this.logger.log(
      `Card settlement processed: txn=${txn.id} amount=R${(settledAmount / 100).toFixed(2)}`,
    );
  }

  /**
   * Daily job: detect stale PENDING refills and overdue advances
   */
  // @Cron(CronExpression.EVERY_DAY_AT_6AM) — uncomment when @nestjs/schedule is added
  async dailyReconciliation(): Promise<void> {
    this.logger.log('Starting daily reconciliation...');
    // TODO: Check for AUTHORIZED card txns older than 7 days → flag for review
    // TODO: Check for OUTSTANDING advances older than 7 days → mark OVERDUE
    // TODO: Release aged reserves back to merchant available balance
  }
}
