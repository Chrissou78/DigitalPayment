import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Advance } from './entities/advance.entity';
import { AdvanceStatus } from '../common/enums/advance-status.enum';
import { LedgerEntryType } from '../common/enums/ledger-entry-type.enum';
import { WalletService } from '../wallet/wallet.service';
import { MerchantService } from '../merchant/merchant.service';
import { TransactionService } from '../transaction/transaction.service';

export interface AdvanceOffer {
  eligible: boolean;
  advanceAmount: number;
  advanceFee: number;
  feeRate: number;
  reason?: string;
}

@Injectable()
export class AdvanceService {
  private readonly logger = new Logger(AdvanceService.name);

  constructor(
    @InjectRepository(Advance)
    private readonly advanceRepo: Repository<Advance>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly merchantService: MerchantService,
    private readonly txnService: TransactionService,
    private readonly config: ConfigService,
  ) {}

  async checkEligibility(merchantId: string, transactionId: string): Promise<AdvanceOffer> {
    const merchant = await this.merchantService.findById(merchantId);
    const txn = await this.txnService.findById(transactionId);
    const advanceFeePercent = this.config.get<number>('ADVANCE_FEE_PERCENT', 1.5);
    const maxPercent = this.config.get<number>('ADVANCE_MAX_PERCENT_OF_VOLUME', 30);

    // Check eligibility rules
    const daysSinceCreation =
      (Date.now() - new Date(merchant.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation < 30) {
      return { eligible: false, advanceAmount: 0, advanceFee: 0, feeRate: 0, reason: 'Merchant active < 30 days' };
    }

    if (merchant.trailingVolume30d < 1000000) {
      // R10,000
      return { eligible: false, advanceAmount: 0, advanceFee: 0, feeRate: 0, reason: 'Trailing volume < R10,000' };
    }

    if (merchant.chargebackRate >= 0.02) {
      return { eligible: false, advanceAmount: 0, advanceFee: 0, feeRate: 0, reason: 'Chargeback rate >= 2%' };
    }

    // Check no overdue advances
    const overdue = await this.advanceRepo.count({
      where: { merchantId, status: AdvanceStatus.OVERDUE },
    });
    if (overdue > 0) {
      return { eligible: false, advanceAmount: 0, advanceFee: 0, feeRate: 0, reason: 'Outstanding overdue advance' };
    }

    // Calculate advance: transaction amount minus reserve
    const reservePercent = this.config.get<number>('MERCHANT_RESERVE_PERCENT', 5);
    const advanceBase = txn.amount - Math.round(txn.amount * (reservePercent / 100));
    const maxAdvance = Math.round(merchant.trailingVolume30d * (maxPercent / 100));
    const advanceAmount = Math.min(advanceBase, maxAdvance);
    const advanceFee = Math.round(advanceAmount * (advanceFeePercent / 100));

    return {
      eligible: true,
      advanceAmount,
      advanceFee,
      feeRate: advanceFeePercent,
    };
  }

  async execute(merchantId: string, transactionId: string): Promise<Advance> {
    const offer = await this.checkEligibility(merchantId, transactionId);
    if (!offer.eligible) {
      throw new BadRequestException(`Advance not eligible: ${offer.reason}`);
    }

    const merchant = await this.merchantService.findById(merchantId);
    const wallet = await this.walletService.findByMerchantId(merchantId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // Credit merchant wallet with advance amount
      await this.walletService.credit(
        queryRunner,
        wallet.id,
        offer.advanceAmount,
        LedgerEntryType.ADVANCE,
        transactionId,
        `Card advance: R${(offer.advanceAmount / 100).toFixed(2)}`,
      );

      // Create advance record
      const advance = queryRunner.manager.create(Advance, {
        merchantId,
        transactionId,
        merchantWalletId: wallet.id,
        principal: offer.advanceAmount,
        fee: offer.advanceFee,
        status: AdvanceStatus.OUTSTANDING,
      });
      const saved = await queryRunner.manager.save(advance);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Advance ${saved.id}: R${(offer.advanceAmount / 100).toFixed(2)} ` +
        `to merchant ${merchantId}, fee R${(offer.advanceFee / 100).toFixed(2)}`,
      );

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async settleFromCardSettlement(
    transactionId: string,
    settledAmount: number,
  ): Promise<void> {
    const advance = await this.advanceRepo.findOne({
      where: { transactionId, status: AdvanceStatus.OUTSTANDING },
    });

    if (!advance) return; // No advance to settle

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Mark advance as settled
      advance.status = AdvanceStatus.SETTLED;
      advance.settledAt = new Date();
      await queryRunner.manager.save(advance);

      // Credit merchant with remainder: settled - principal - fee
      const remainder = settledAmount - advance.principal - advance.fee;
      if (remainder > 0) {
        await this.walletService.credit(
          queryRunner,
          advance.merchantWalletId,
          remainder,
          LedgerEntryType.AVAILABLE,
          transactionId,
          `Card settlement remainder after advance`,
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Advance ${advance.id} settled. Remainder: R${(remainder / 100).toFixed(2)}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
