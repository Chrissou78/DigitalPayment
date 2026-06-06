
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CashInStatus, LedgerEntryType, LedgerReferenceType, KycTier,
  CASH_IN_FEE_TIERS, KYC_LIMITS, CashInFeeTier,
} from '@payduka/shared';

import { CashIn } from './entities/cash-in.entity';
import { CreateCashInDto } from './dto/create-cash-in.dto';
import { WalletService } from '../wallet/wallet.service';
import { Wallet } from '../wallet/entities/wallet.entity';

@Injectable()
export class CashInService {
  private readonly logger = new Logger(CashInService.name);

  constructor(
    @InjectRepository(CashIn)
    private readonly cashInRepo: Repository<CashIn>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly emitter: EventEmitter2,
  ) {}

  private findFeeTier(amount: number): CashInFeeTier {
    const tier = CASH_IN_FEE_TIERS.find(
      (t) => amount >= t.minAmount && amount <= t.maxAmount,
    );
    if (!tier) {
      throw new BadRequestException(
        `Amount R${(amount / 100).toFixed(2)} outside supported range`,
      );
    }
    return tier;
  }

  private async checkKycLimits(
    customerWalletId: string,
    amount: number,
    kycTier: KycTier,
  ): Promise<void> {
    const limits = KYC_LIMITS[kycTier];

    // Check daily total
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyTotal = await this.cashInRepo
      .createQueryBuilder('ci')
      .select('COALESCE(SUM(ci.depositAmount), 0)', 'total')
      .where('ci.customerWalletId = :walletId', { walletId: customerWalletId })
      .andWhere('ci.status IN (:...statuses)', {
        statuses: [CashInStatus.COMPLETED, CashInStatus.CONFIRMED, CashInStatus.PENDING],
      })
      .andWhere('ci.createdAt >= :today', { today })
      .getRawOne();

    if (Number(dailyTotal.total) + amount > limits.dailyLimit) {
      throw new BadRequestException(
        `Daily cash-in limit exceeded for ${kycTier}. ` +
        `Limit: R${(limits.dailyLimit / 100).toFixed(2)}, ` +
        `Used: R${(Number(dailyTotal.total) / 100).toFixed(2)}`,
      );
    }

    // Check monthly total
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyTotal = await this.cashInRepo
      .createQueryBuilder('ci')
      .select('COALESCE(SUM(ci.depositAmount), 0)', 'total')
      .where('ci.customerWalletId = :walletId', { walletId: customerWalletId })
      .andWhere('ci.status IN (:...statuses)', {
        statuses: [CashInStatus.COMPLETED, CashInStatus.CONFIRMED, CashInStatus.PENDING],
      })
      .andWhere('ci.createdAt >= :monthStart', { monthStart })
      .getRawOne();

    if (Number(monthlyTotal.total) + amount > limits.monthlyLimit) {
      throw new BadRequestException(
        `Monthly cash-in limit exceeded for ${kycTier}. ` +
        `Limit: R${(limits.monthlyLimit / 100).toFixed(2)}`,
      );
    }
  }

  async initiate(
    agentMerchantId: string,
    agentWalletId: string,
    dto: CreateCashInDto,
  ): Promise<CashIn> {
    // 1. Resolve customer wallet
    // In production: lookup by phone → wallet mapping
    // For now: assume customerIdentifier is walletId
    const customerWalletId = dto.customerIdentifier;

    // 2. Validate fee tier
    const tier = this.findFeeTier(dto.amount);

    // 3. Check KYC limits (default TIER_0 for now)
    await this.checkKycLimits(customerWalletId, dto.amount, KycTier.TIER_0);

    // 4. Check agent has sufficient float
    const agentBalance = await this.walletService.getBalance(agentWalletId);
    if (agentBalance.available < dto.amount) {
      throw new BadRequestException(
        `Insufficient agent float. Available: R${(agentBalance.available / 100).toFixed(2)}, ` +
        `Required: R${(dto.amount / 100).toFixed(2)}`,
      );
    }

    // 5. Generate confirmation code
    const confirmationCode = Math.random().toString().slice(2, 8);

    // 6. Create cash-in record
    const netCredit = dto.amount - tier.customerFee;

    const cashIn = this.cashInRepo.create({
      agentMerchantId,
      agentWalletId,
      customerWalletId,
      customerPhone: dto.customerIdentifier,
      depositAmount: dto.amount,
      customerFee: tier.customerFee,
      merchantCommission: tier.merchantCommission,
      protocolFee: tier.protocolFee,
      netCreditAmount: netCredit,
      status: CashInStatus.PENDING,
      confirmationCode,
      metadata: dto.metadata,
    });

    const saved = await this.cashInRepo.save(cashIn);

    // TODO: Send SMS with confirmation code to customer phone

    this.logger.log(
      `Cash-in ${saved.id} initiated: R${(dto.amount / 100).toFixed(2)} ` +
      `at merchant ${agentMerchantId}, code=${confirmationCode}`,
    );

    return saved;
  }

  async confirm(cashInId: string, confirmationCode: string): Promise<CashIn> {
    const cashIn = await this.cashInRepo.findOneOrFail({ where: { id: cashInId } });

    if (cashIn.status !== CashInStatus.PENDING) {
      throw new BadRequestException(`Cash-in ${cashInId} is not in PENDING state`);
    }

    if (cashIn.confirmationCode !== confirmationCode) {
      throw new BadRequestException('Invalid confirmation code');
    }

    // Execute the atomic ledger operations
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // 1. Debit agent wallet (they gave out their float as cash credit)
      await this.walletService.debit(
        queryRunner,
        cashIn.agentWalletId,
        cashIn.depositAmount,
        LedgerEntryType.DEBIT,
        LedgerReferenceType.CASH_IN,
        cashIn.id,
        `Cash-in float debit: R${(cashIn.depositAmount / 100).toFixed(2)}`,
      );

      // 2. Credit customer wallet with net amount
      await this.walletService.credit(
        queryRunner,
        cashIn.customerWalletId,
        cashIn.netCreditAmount,
        LedgerEntryType.CREDIT,
        LedgerReferenceType.CASH_IN,
        cashIn.id,
        `Cash deposit: R${(cashIn.netCreditAmount / 100).toFixed(2)}`,
      );

      // 3. Credit agent commission
      await this.walletService.credit(
        queryRunner,
        cashIn.agentWalletId,
        cashIn.merchantCommission,
        LedgerEntryType.CREDIT,
        LedgerReferenceType.COMMISSION,
        cashIn.id,
        `Cash-in commission: R${(cashIn.merchantCommission / 100).toFixed(2)}`,
      );

      // 4. Protocol fee is retained (already deducted from customer net credit)
      // In production: credit to PayDuka revenue wallet

      // 5. Update status
      cashIn.status = CashInStatus.COMPLETED;
      await queryRunner.manager.save(cashIn);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Cash-in ${cashIn.id} completed. Customer credited R${(cashIn.netCreditAmount / 100).toFixed(2)}, ` +
        `agent commission R${(cashIn.merchantCommission / 100).toFixed(2)}`,
      );

      // 6. Emit event for notifications + refill check
      this.emitter.emit('cashin.completed', {
        cashInId: cashIn.id,
        agentWalletId: cashIn.agentWalletId,
        customerWalletId: cashIn.customerWalletId,
        amount: cashIn.depositAmount,
      });

      return cashIn;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Cash-in ${cashInId} failed: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
