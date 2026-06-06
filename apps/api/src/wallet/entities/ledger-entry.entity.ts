import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Wallet } from "./wallet.entity";
import { LedgerEntryType } from "../../common/enums/ledger-entry-type.enum";

const bigintTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};

@Entity("ledger_entries")
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  walletId!: string;

  @ManyToOne(() => Wallet, (w) => w.ledgerEntries)
  @JoinColumn({ name: "walletId" })
  wallet!: Wallet;

  @Column({ type: "enum", enum: LedgerEntryType })
  type!: LedgerEntryType;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  balanceAfter!: number;

  @Column("uuid", { nullable: true })
  transactionId!: string;

  @Column({ nullable: true })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
