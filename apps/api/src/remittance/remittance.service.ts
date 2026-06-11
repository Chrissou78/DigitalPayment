import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { v4 as uuid } from "uuid";
import { LedgerEntryType, LedgerReferenceType } from "@payduka/shared";

import { Remittance } from "./entities/remittance.entity";
import { CreateRemittanceDto } from "./dto/create-remittance.dto";
import { CollectRemittanceDto } from "./dto/collect-remittance.dto";
import { WalletService } from "../wallet/wallet.service";

@Injectable()
export class RemittanceService {
  private readonly logger = new Logger(RemittanceService.name);

  constructor(
    @InjectRepository(Remittance)
    private readonly remitRepo: Repository<Remittance>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly emitter: EventEmitter2,
  ) {}

  private generateTrackingCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async send(
    senderMerchantId: string,
    senderWalletId: string,
    dto: CreateRemittanceDto,
  ): Promise<Remittance> {
    const agentBalance = await this.walletService.getBalance(senderWalletId);
    if (agentBalance.available < dto.amount) {
      throw new BadRequestException("Insufficient agent float for remittance");
    }

    // Fee calculation (simplified — adjust to your tier logic)
    const senderFee = Math.round(dto.amount * 0.02);
    const sendMerchantCommission = Math.round(dto.amount * 0.01);
    const collectMerchantCommission = Math.round(dto.amount * 0.01);
    const protocolFee = Math.round(dto.amount * 0.005);
    const recipientAmount = dto.amount - senderFee;

    const remittanceId = uuid();
    const trackingCode = this.generateTrackingCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction("SERIALIZABLE");

    try {
      await this.walletService.debit(
        queryRunner,
        senderWalletId,
        dto.amount,
        LedgerEntryType.DEBIT,
        LedgerReferenceType.REMITTANCE,
        remittanceId,
        `Remittance send: R${(dto.amount / 100).toFixed(2)} to ${dto.recipientPhone}`,
      );

      await this.walletService.credit(
        queryRunner,
        senderWalletId,
        sendMerchantCommission,
        LedgerEntryType.CREDIT,
        LedgerReferenceType.COMMISSION,
        remittanceId,
        `Remittance send commission`,
      );

      const remittance = queryRunner.manager.create(Remittance, {
        id: remittanceId,
        trackingCode,
        senderPhone: dto.senderPhone,
        recipientPhone: dto.recipientPhone,
        sendMerchantId: senderMerchantId,
        amount: dto.amount,
        senderFee,
        sendMerchantCommission,
        collectMerchantCommission,
        protocolFee,
        status: "ESCROWED",
        expiresAt,
      });

      const saved = await queryRunner.manager.save(remittance);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Remittance ${saved.id}: R${(dto.amount / 100).toFixed(2)} ` +
        `from ${senderMerchantId} to ${dto.recipientPhone}, code=${trackingCode}`,
      );

      this.emitter.emit("remittance.created", {
        remittanceId: saved.id,
        recipientPhone: dto.recipientPhone,
        trackingCode,
        amount: recipientAmount,
      });

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async collect(
    collectingMerchantId: string,
    collectingWalletId: string,
    dto: CollectRemittanceDto,
  ): Promise<Remittance> {
    const remittance = await this.remitRepo.findOne({
      where: {
        trackingCode: dto.collectionCode,
        recipientPhone: dto.recipientPhone,
        status: "ESCROWED",
      },
    });

    if (!remittance) {
      throw new NotFoundException("No remittance found with that code and phone number");
    }

    if (new Date() > remittance.expiresAt) {
      remittance.status = "EXPIRED";
      await this.remitRepo.save(remittance);
      throw new BadRequestException("Collection code has expired");
    }

    const recipientAmount = remittance.amount - remittance.senderFee;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction("SERIALIZABLE");

    try {
      await this.walletService.credit(
        queryRunner,
        collectingWalletId,
        recipientAmount,
        LedgerEntryType.CREDIT,
        LedgerReferenceType.REMITTANCE,
        remittance.id,
        `Remittance collection: R${(recipientAmount / 100).toFixed(2)}`,
      );

      await this.walletService.credit(
        queryRunner,
        collectingWalletId,
        remittance.collectMerchantCommission,
        LedgerEntryType.CREDIT,
        LedgerReferenceType.COMMISSION,
        remittance.id,
        `Remittance collection commission`,
      );

      remittance.status = "COLLECTED";
      remittance.collectMerchantId = collectingMerchantId;
      remittance.collectedAt = new Date();
      await queryRunner.manager.save(remittance);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Remittance ${remittance.id} collected at merchant ${collectingMerchantId}`,
      );

      this.emitter.emit("remittance.collected", {
        remittanceId: remittance.id,
        collectingMerchantId,
        senderPhone: remittance.senderPhone,
        recipientPhone: remittance.recipientPhone,
        amount: recipientAmount,
      });

      return remittance;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByCollectionCode(code: string): Promise<Remittance> {
    return this.remitRepo.findOneOrFail({
      where: { trackingCode: code },
    });
  }
}
