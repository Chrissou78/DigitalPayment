import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, MoreThan } from "typeorm";
import { Wallet } from "../wallet/entities/wallet.entity";
import { LedgerEntry } from "../wallet/entities/ledger-entry.entity";
import { LedgerEntryType } from "../common/enums/ledger-entry-type.enum";

@Injectable()
export class StakingService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Stake: move funds from AVAILABLE to STAKED.
   * Purely a DB operation — the settlement bridge handles
   * the actual on-chain staking in batches.
   */
  async stake(walletId: string, amountCents: number) {
    if (amountCents <= 0) throw new BadRequestException("Amount must be > 0");

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: walletId },
        lock: { mode: "pessimistic_write" },
      });

      if (!wallet) throw new BadRequestException("Wallet not found");
      if (wallet.available < amountCents) {
        throw new BadRequestException("Insufficient available balance");
      }

      // Move from available to staked
      wallet.available -= amountCents;
      wallet.staked = (wallet.staked ?? 0) + amountCents;
      await manager.save(wallet);

      // Ledger entries
      await manager.save(LedgerEntry, {
        walletId,
        type: LedgerEntryType.STAKE_LOCK,
        amount: -amountCents,
        balanceAfter: wallet.available,
        description: `Staked R${(amountCents / 100).toFixed(2)}`,
      });

      return {
        available: wallet.available,
        staked: wallet.staked,
        message: `R${(amountCents / 100).toFixed(2)} staked successfully`,
      };
    });
  }

  /**
   * Unstake: move funds from STAKED back to AVAILABLE.
   */
  async unstake(walletId: string, amountCents: number) {
    if (amountCents <= 0) throw new BadRequestException("Amount must be > 0");

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: walletId },
        lock: { mode: "pessimistic_write" },
      });

      if (!wallet) throw new BadRequestException("Wallet not found");
      if ((wallet.staked ?? 0) < amountCents) {
        throw new BadRequestException("Insufficient staked balance");
      }

      wallet.staked -= amountCents;
      wallet.available += amountCents;
      await manager.save(wallet);

      await manager.save(LedgerEntry, {
        walletId,
        type: LedgerEntryType.STAKE_UNLOCK,
        amount: amountCents,
        balanceAfter: wallet.available,
        description: `Unstaked R${(amountCents / 100).toFixed(2)}`,
      });

      return {
        available: wallet.available,
        staked: wallet.staked,
        message: `R${(amountCents / 100).toFixed(2)} unstaked successfully`,
      };
    });
  }

  /**
   * Distribute staking rewards — called daily by cron.
   * Calculates proportional rewards based on APY for each staker.
   */
  async distributeRewards(apyPercent: number) {
    const dailyRate = apyPercent / 100 / 365.25;

    const stakers = await this.walletRepo.find({
      where: { staked: MoreThan(0) },
    });

    const stakersWithBalance = stakers.filter((w) => (w.staked ?? 0) > 0);

    let totalDistributed = 0;

    for (const wallet of stakersWithBalance) {
      const reward = Math.floor(wallet.staked * dailyRate);
      if (reward <= 0) continue;

      await this.dataSource.transaction(async (manager) => {
        const w = await manager.findOne(Wallet, {
          where: { id: wallet.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!w) return;

        w.available += reward;
        await manager.save(w);

        await manager.save(LedgerEntry, {
          walletId: w.id,
          type: LedgerEntryType.STAKING_REWARD,
          amount: reward,
          balanceAfter: w.available,
          description: `Staking reward: R${(reward / 100).toFixed(2)} (${apyPercent}% APY)`,
        });
      });

      totalDistributed += reward;
    }

    return {
      stakersRewarded: stakersWithBalance.length,
      totalDistributed,
    };
  }

  async getStakeInfo(walletId: string) {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) throw new BadRequestException("Wallet not found");

    return {
      available: wallet.available,
      staked: wallet.staked ?? 0,
      total: wallet.available + (wallet.staked ?? 0),
    };
  }
}
