import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { ethers } from "ethers";
import { ConfigService } from "@nestjs/config";
import { Transaction } from "../transaction/transaction.entity";

const POOL_ABI = [
  "function batchSettle(uint256 totalVolumeZarCents, bytes32 offChainBatchId) external",
  "function withdraw(address to, uint256 zarCents, bytes32 offChainRef) external",
  "function poolBalance() external view returns (uint256)",
  "function poolBalanceInZar() external view returns (uint256)",
  "function totalBurned() external view returns (uint256)",
  "function totalToTreasury() external view returns (uint256)",
  "function batchNonce() external view returns (uint256)",
];

const ORACLE_ABI = [
  "function pdukaZar() external view returns (uint256)",
  "function pdukaUsd() external view returns (uint256)",
  "function usdZar() external view returns (uint256)",
  "function zarToPduka(uint256 zarAmount) external view returns (uint256)",
  "function pdukaToZar(uint256 pdukaAmount) external view returns (uint256)",
  "function isStale() external view returns (bool)",
  "function setPdukaUsd(uint256 rate) external",
  "function setUsdZar(uint256 rate) external",
];

const TREASURY_ABI = [
  "function totalTreasuryBalance() external view returns (uint256)",
  "function totalAssignedToVaults() external view returns (uint256)",
  "function unassignedBalance() external view returns (uint256)",
  "function vaultCount() external view returns (uint256)",
  "function getVaultInfo(uint256 index) external view returns (address, uint256, uint256)",
];

const STAKING_ABI = [
  "function totalStaked() external view returns (uint256)",
  "function apyBps() external view returns (uint256)",
];

@Injectable()
export class SettlementBridgeService {
  private readonly logger = new Logger(SettlementBridgeService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private pool: ethers.Contract;
  private oracle: ethers.Contract;
  private treasury: ethers.Contract;
  private staking: ethers.Contract;

  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    private readonly config: ConfigService,
  ) {
    const rpcUrl = this.config.get<string>("POLYGON_RPC_URL");
    const pk = this.config.get<string>("SETTLEMENT_PRIVATE_KEY");

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(pk, this.provider);

    this.pool = new ethers.Contract(
      this.config.get("PDUKA_POOL_ADDRESS"),
      POOL_ABI,
      this.wallet,
    );
    this.oracle = new ethers.Contract(
      this.config.get("PDUKA_ORACLE_ADDRESS"),
      ORACLE_ABI,
      this.wallet,
    );
    this.treasury = new ethers.Contract(
      this.config.get("PDUKA_TREASURY_ADDRESS"),
      TREASURY_ABI,
      this.provider, // read-only
    );
    this.staking = new ethers.Contract(
      this.config.get("STAKING_POOL_ADDRESS"),
      STAKING_ABI,
      this.provider,
    );
  }

  // ── Batch Settlement (every hour) ──

  @Cron(CronExpression.EVERY_HOUR)
  async settleBatch() {
    this.logger.log("Starting batch settlement...");

    const unsettled = await this.txnRepo.find({
      where: { status: "COMPLETED", onChainBatchId: IsNull() },
    });

    if (unsettled.length === 0) {
      this.logger.log("No unsettled transactions.");
      return;
    }

    // Sum all transaction amounts (ZAR cents)
    const totalVolumeZarCents = unsettled.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );

    const batchId = ethers.encodeBytes32String(
      `B${Date.now().toString(36)}`,
    );

    try {
      // Contract reads oracle internally, does conversion + burn + treasury
      const tx = await this.pool.batchSettle(totalVolumeZarCents, batchId);
      this.logger.log(`Batch tx: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Confirmed block ${receipt.blockNumber}`);

      // Mark settled
      const ids = unsettled.map((t) => t.id);
      await this.txnRepo
        .createQueryBuilder()
        .update()
        .set({
          onChainBatchId: batchId,
          onChainTxHash: tx.hash,
          settledOnChainAt: new Date(),
        })
        .whereInIds(ids)
        .execute();

      this.logger.log(
        `Settled ${unsettled.length} txns, R${(totalVolumeZarCents / 100).toFixed(2)} volume`,
      );
    } catch (err) {
      this.logger.error("Settlement failed — will retry next hour", err);
    }
  }

  // ── Oracle Rate Updates (every 15 min) ──

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateOracleRates() {
    try {
      // Fetch USD/ZAR from external API
      const fxRes = await fetch(
        "https://api.exchangerate-api.com/v4/latest/USD",
      );
      const fxData = await fxRes.json();
      const usdZar = fxData.rates?.ZAR;

      if (!usdZar) {
        this.logger.warn("Could not fetch USD/ZAR rate");
        return;
      }

      // Convert to 18 decimals
      const usdZarWei = ethers.parseEther(usdZar.toString());

      // Update on-chain
      const tx = await this.oracle.setUsdZar(usdZarWei);
      await tx.wait();
      this.logger.log(`Oracle USD/ZAR updated: ${usdZar}`);

      // PDUKA/USD rate: during pre-listing, set from config (ICO price).
      // Post-listing, fetch from QuickSwap TWAP or DEX aggregator.
      const pdukaUsd = this.config.get<number>("PDUKA_USD_RATE") ?? 0.005;
      const pdukaUsdWei = ethers.parseEther(pdukaUsd.toString());

      const tx2 = await this.oracle.setPdukaUsd(pdukaUsdWei);
      await tx2.wait();
      this.logger.log(`Oracle PDUKA/USD updated: ${pdukaUsd}`);
    } catch (err) {
      this.logger.error("Oracle update failed", err);
    }
  }

  // ── Merchant Off-Ramp ──

  async withdrawForMerchant(
    merchantWalletAddress: string,
    zarCents: number,
    offChainRef: string,
  ): Promise<string> {
    const ref = ethers.encodeBytes32String(offChainRef.slice(0, 31));
    const tx = await this.pool.withdraw(merchantWalletAddress, zarCents, ref);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ── Read-Only: On-Chain Stats (for admin dashboard) ──

  async getOnChainStats() {
    const [
      poolBalance,
      poolBalanceZar,
      totalBurned,
      totalToTreasury,
      batchNonce,
      pdukaZar,
      pdukaUsd,
      usdZar,
      isStale,
      treasuryTotal,
      treasuryAssigned,
      treasuryUnassigned,
      vaultCount,
      stakingTotalStaked,
      stakingApyBps,
    ] = await Promise.all([
      this.pool.poolBalance(),
      this.pool.poolBalanceInZar(),
      this.pool.totalBurned(),
      this.pool.totalToTreasury(),
      this.pool.batchNonce(),
      this.oracle.pdukaZar(),
      this.oracle.pdukaUsd(),
      this.oracle.usdZar(),
      this.oracle.isStale(),
      this.treasury.totalTreasuryBalance(),
      this.treasury.totalAssignedToVaults(),
      this.treasury.unassignedBalance(),
      this.treasury.vaultCount(),
      this.staking.totalStaked(),
      this.staking.apyBps(),
    ]);

    // Get vault details
    const vaults = [];
    for (let i = 0; i < Number(vaultCount); i++) {
      const [addr, balance, capacity] = await this.treasury.getVaultInfo(i);
      vaults.push({
        address: addr,
        balance: ethers.formatEther(balance),
        capacityRemaining: ethers.formatEther(capacity),
      });
    }

    return {
      pool: {
        balance: ethers.formatEther(poolBalance),
        balanceZar: ethers.formatEther(poolBalanceZar),
        totalBurned: ethers.formatEther(totalBurned),
        totalToTreasury: ethers.formatEther(totalToTreasury),
        batchCount: Number(batchNonce),
      },
      oracle: {
        pdukaZar: ethers.formatEther(pdukaZar),
        pdukaUsd: ethers.formatEther(pdukaUsd),
        usdZar: ethers.formatEther(usdZar),
        isStale,
      },
      treasury: {
        totalBalance: ethers.formatEther(treasuryTotal),
        assignedToVaults: ethers.formatEther(treasuryAssigned),
        unassigned: ethers.formatEther(treasuryUnassigned),
        vaultCount: Number(vaultCount),
        vaults,
      },
      staking: {
        totalStaked: ethers.formatEther(stakingTotalStaked),
        apyPercent: Number(stakingApyBps) / 100,
      },
    };
  }
}
