import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Advance } from '../advance/entities/advance.entity';
import { Refill } from '../refill/entities/refill.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    @InjectRepository(Transaction) private readonly txnRepo: Repository<Transaction>,
    @InjectRepository(Merchant) private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Advance) private readonly advanceRepo: Repository<Advance>,
    @InjectRepository(Refill) private readonly refillRepo: Repository<Refill>,
  ) {}

  @Get('dashboard')
  async getDashboard() {
    const [totalTxns, totalMerchants, outstandingAdvances, pendingRefills] =
      await Promise.all([
        this.txnRepo.count(),
        this.merchantRepo.count(),
        this.advanceRepo.count({ where: { status: 'OUTSTANDING' as any } }),
        this.refillRepo.count({ where: { status: 'PENDING_PAYMENT' as any } }),
      ]);

    return {
      totalTransactions: totalTxns,
      totalMerchants,
      outstandingAdvances,
      pendingRefills,
      timestamp: new Date().toISOString(),
    };
  }
}
