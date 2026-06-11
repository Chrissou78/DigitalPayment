import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { Merchant } from './entities/merchant.entity';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(Merchant)
    private readonly repo: Repository<Merchant>,
    private readonly walletService: WalletService,
  ) {}

  async create(dto: CreateMerchantDto): Promise<any> {
    const apiKey = `pk_${uuid().replace(/-/g, '')}`;
    const apiSecret = `sk_${uuid().replace(/-/g, '')}`;
    const apiSecretHash = await bcrypt.hash(apiSecret, 12);
    const pinHash = await bcrypt.hash(dto.pin, 12);

    const merchant = this.repo.create({
      businessName: dto.businessName,
      phone: dto.phone,
      email: dto.email,
      tradingName: dto.tradingName,
      registrationNumber: dto.registrationNumber,
      apiKey,
      apiSecretHash,
      pinHash,
    });

    const saved = await this.repo.save(merchant);
    await this.walletService.createForMerchant(saved.id);

    const { apiSecretHash: _hash, pinHash: _pin, ...safeData } = saved;
    return { ...safeData, apiSecret };
  }

  async findById(id: string): Promise<Merchant> {
    const m = await this.repo.findOne({ where: { id } });  // removed relations
    if (!m) throw new NotFoundException(`Merchant ${id} not found`);
    return m;
  }

  async findByApiKey(apiKey: string): Promise<Merchant | null> {
    return this.repo.findOne({ where: { apiKey } });  // removed relations
  }


  async updateVolume(id: string, amountCents: number): Promise<void> {
    await this.repo.increment({ id }, 'trailingVolume30d', amountCents);
  }
}
