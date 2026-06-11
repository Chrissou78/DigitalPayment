import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CashIn } from "./entities/cash-in.entity";
import { WalletService } from "../wallet/wallet.service";
import { CreateCashInDto } from "./dto/create-cash-in.dto";
import { ConfigService } from "@nestjs/config";
import { LedgerEntryType, LedgerReferenceType } from "@payduka/shared";

@Injectable()
export class CashInService {
  private readonly logger = new Logger(CashInService.name);

  constructor(
    @InjectRepository(CashIn)
    private readonly cashInRepo: Repository<CashIn>,
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async initiate(merchantId: string, dto: CreateCashInDto) {
    const feePercent = 0.02;
    const commissionPercent = 0.01;
    const protocolPercent = 0.005;

    const customerFee = Math.round(dto.amount * feePercent);
    const merchantCommission = Math.round(dto.amount * commissionPercent);
    const protocolFee = Math.round(dto.amount * protocolPercent);
    const netCredit = dto.amount - customerFee;

    const cashIn = this.cashInRepo.create({
      merchantId,
      customerPhone: dto.customerIdentifier,
      amount: dto.amount,
      customerFee,
      merchantCommission,
      protocolFee,
    });

    const saved = await this.cashInRepo.save(cashIn);

    this.logger.log(
      `Cash-in ${saved.id} initiated: R${(dto.amount / 100).toFixed(2)} ` +
      `from ${dto.customerIdentifier} via merchant ${merchantId}`,
    );

    return saved;
  }

  async confirm(cashInId: string) {
    const cashIn = await this.cashInRepo.findOneOrFail({ where: { id: cashInId } });

    if (cashIn.status !== "INITIATED") {
      throw new BadRequestException("Cash-in is not in INITIATED status");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction("SERIALIZABLE");

    try {
      // Look up wallets
      const merchantWallet = await this.walletService.findByMerchantId(cashIn.merchantId);
      const customerWallet = await this.walletService.findByPhone(cashIn.customerPhone);

      const netCredit = cashIn.amount - cashIn.customerFee;

      // Debit merchant float
      await this.walletService.debit(
        queryRunner, merchantWallet.id, cashIn.amount,
        LedgerEntryType.DEBIT, LedgerReferenceType.CASH_IN, cashIn.id,
        `Cash-in float debit: R${(cashIn.amount / 100).toFixed(2)}`,
      );

      // Credit customer wallet
      await this.walletService.credit(
        queryRunner, customerWallet.id, netCredit,
        LedgerEntryType.CREDIT, LedgerReferenceType.CASH_IN, cashIn.id,
        `Cash deposit: R${(netCredit / 100).toFixed(2)}`,
      );

      // Credit merchant commission
      await this.walletService.credit(
        queryRunner, merchantWallet.id, cashIn.merchantCommission,
        LedgerEntryType.CREDIT, LedgerReferenceType.COMMISSION, cashIn.id,
        `Cash-in commission: R${(cashIn.merchantCommission / 100).toFixed(2)}`,
      );

      // Update status
      cashIn.status = "COMPLETED";
      await queryRunner.manager.save(cashIn);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Cash-in ${cashIn.id} completed. Customer credited R${(netCredit / 100).toFixed(2)}`,
      );

      this.eventEmitter.emit("cashin.completed", {
        cashInId: cashIn.id,
        merchantId: cashIn.merchantId,
        customerPhone: cashIn.customerPhone,
        amount: cashIn.amount,
      });

      return cashIn;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
