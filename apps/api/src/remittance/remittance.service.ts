import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RemittanceStatus, LedgerEntryType,
  REMITTANCE_FEE_TIERS, RemittanceFeeTier,
} from '@payduka/shared';

import { Remittance } from './entities/remittance.entity';
import { CreateRemittanceDto } from './dto/create-remittance.dto';
import { CollectRemittanceDto } from './dto/collect-remittance.dto';
import { WalletService } from '../wallet/wallet.service';

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

  private findFeeTier(amount: number): RemittanceFeeTier {
    const tier = REMITTANCE_FEE_TIERS.find(
      (t) => amount >= t.minAmount && amount <= t.maxAmount,
    );
    if (!tier) {
      throw new BadRequestException(
        `Amount R${(amount / 100).toFixed(2)} outside supported remittance range`,
      );
    }
    return tier;
  }

  private generateCollectionCode(): string {
    // 8-character alphanumeric, uppercase
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async send(
    senderMerchantId: string,
    senderMerchantWalletId: string,
    dto: CreateRemittanceDto,
  ): Promise<Remittance> {
    const tier = this.findFeeTier(dto.amount);

    // Check agent float
    const agentBalance = await this.walletService.getBalance(senderMerchantWalletId);
    if (agentBalance.available < dto.amount) {
      throw new BadRequestException('Insufficient agent float for remittance');
    }

    const recipientAmount = dto.amount; // sender pays fees on top
    const collectionCode = this.generateCollectionCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // Atomic: debit agent, hold funds in escrow
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // Debit sending merchant's float (full send amount)
      await this.walletService.debit(
        queryRunner,
        senderMerchantWalletId,
        dto.amount,
        LedgerEntryType.REMITTANCE_OUT,
        null, // txn ID set below
        `Remittance send: R${(dto.amount / 100).toFixed(2)} to ${dto.recipientPhone}`,
      );

      // Credit sending merchant commission
      await this.walletService.credit(
        queryRunner,
        senderMerchantWalletId,
        tier.sendingMerchantCommission,
        LedgerEntryType.COMMISSION,
        null,
        `Remittance send commission`,
      );

      // Create remittance record
      const remittance = queryRunner.manager.create(Remittance, {
        senderMerchantId,
        senderMerchantWalletId,
        senderPhone: dto.senderPhone,
        senderName: dto.senderName,
        recipientPhone: dto.recipientPhone,
        recipientName: dto.recipientName,
        sendAmount: dto.amount,
        senderFee: tier.senderFee,
        sendingMerchantCommission: tier.sendingMerchantCommission,
        receivingMerchantCommission: tier.receivingMerchantCommission,
        protocolFee: tier.protocolFee,
        recipientAmount,
        collectionCode,
        expiresAt,
        status: RemittanceStatus.READY_FOR_COLLECTION,
        metadata: dto.metadata,
      });

      const saved = await queryRunner.manager.save(remittance);

      await queryRunner.commitTransaction();

      // TODO: Send SMS to recipient with collection code
      this.logger.log(
        `Remittance ${saved.id}: R${(dto.amount / 100).toFixed(2)} ` +
        `from ${senderMerchantId} to ${dto.recipientPhone}, code=${collectionCode}`,
      );

      this.emitter.emit('remittance.created', {
        remittanceId: saved.id,
        recipientPhone: dto.recipientPhone,
        collectionCode,
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
    collectingMerchantWalletId: string,
    dto: CollectRemittanceDto,
  ): Promise<Remittance> {
    const remittance = await this.remitRepo.findOne({
      where: {
        collectionCode: dto.collectionCode,
        recipientPhone: dto.recipientPhone,
        status: RemittanceStatus.READY_FOR_COLLECTION,
      },
    });

    if (!remittance) {
      throw new NotFoundException('No remittance found with that code and phone number');
    }

    if (new Date() > remittance.expiresAt) {
      remittance.status = RemittanceStatus.EXPIRED;
      await this.remitRepo.save(remittance);
      throw new BadRequestException('Collection code has expired');
    }

    // Check collecting merchant has enough cash (they need to hand out physical cash)
    // This is a business-logic check — the merchant attests they have the cash
    // The digital side: we credit their wallet since they're disbursing physical cash

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // Credit collecting merchant's wallet (they gave out cash, so they receive digital equivalent)
      await this.walletService.credit(
        queryRunner,
        collectingMerchantWalletId,
        remittance.recipientAmount,
        LedgerEntryType.REMITTANCE_IN,
        remittance.id,
        `Remittance collection: R${(remittance.recipientAmount / 100).toFixed(2)}`,
      );

      // Credit collecting merchant commission
      await this.walletService.credit(
        queryRunner,
        collectingMerchantWalletId,
        remittance.receivingMerchantCommission,
        LedgerEntryType.COMMISSION,
        remittance.id,
        `Remittance collection commission`,
      );

      // Update remittance record
      remittance.status = RemittanceStatus.COLLECTED;
      remittance.collectingMerchantId = collectingMerchantId;
      remittance.collectingMerchantWalletId = collectingMerchantWalletId;
      remittance.collectedAt = new Date();
      await queryRunner.manager.save(remittance);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Remittance ${remittance.id} collected at merchant ${collectingMerchantId}`,
      );

      this.emitter.emit('remittance.collected', {
        remittanceId: remittance.id,
        collectingMerchantId,
        senderPhone: remittance.senderPhone,
        recipientPhone: remittance.recipientPhone,
        amount: remittance.recipientAmount,
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
      where: { collectionCode: code },
    });
  }
}
