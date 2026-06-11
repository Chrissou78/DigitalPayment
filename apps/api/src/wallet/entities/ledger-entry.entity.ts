import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { Wallet } from "./wallet.entity";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("ledger_entries")
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  walletId!: string;

  @ManyToOne(() => Wallet, (w) => w.ledgerEntries)
  @JoinColumn({ name: "wallet_id" })
  wallet!: Wallet;

  @Column({ type: "enum", enum: [
    "DEBIT", "CREDIT", "RESERVE_HOLD", "RESERVE_RELEASE",
    "STAKE_LOCK", "STAKE_UNLOCK", "STAKING_REWARD",
    "FEE_REVENUE", "ADVANCE_CREDIT", "ADVANCE_RECOVERY"
  ]})
  type!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  balanceAfter!: number;

  @Column({ length: 50, nullable: true })
  referenceType!: string;

  @Column("uuid", { nullable: true })
  referenceId!: string;

  @Column({ length: 500, nullable: true })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
