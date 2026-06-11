// apps/api/src/staking/staking.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Wallet } from "../wallet/entities/wallet.entity";
import { LedgerEntry } from "../wallet/entities/ledger-entry.entity";
import { StakingService } from "./staking.service";
import { StakingController } from "./staking.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, LedgerEntry])],
  providers: [StakingService],
  controllers: [StakingController],
  exports: [StakingService],
})
export class StakingModule {}
