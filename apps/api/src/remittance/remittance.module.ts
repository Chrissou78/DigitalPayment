import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remittance } from './entities/remittance.entity';
import { RemittanceService } from './remittance.service';
import { RemittanceController } from './remittance.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Remittance]), WalletModule],
  controllers: [RemittanceController],
  providers: [RemittanceService],
  exports: [RemittanceService],
})
export class RemittanceModule {}
