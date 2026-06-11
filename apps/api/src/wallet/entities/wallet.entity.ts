import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { LedgerEntry } from "./ledger-entry.entity";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("wallets")
export class Wallet {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  ownerId!: string;

  @Column({ type: "enum", enum: ["MERCHANT", "CUSTOMER"] })
  ownerType!: "MERCHANT" | "CUSTOMER";

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  available!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  reserved!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  staked!: number;

  @Column({ length: 3, default: "ZAR" })
  currency!: string;

  @Column({ type: "enum", enum: ["ACTIVE", "FROZEN", "CLOSED"], default: "ACTIVE" })
  status!: string;

  @OneToMany(() => LedgerEntry, (entry) => entry.wallet)
  ledgerEntries!: LedgerEntry[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
