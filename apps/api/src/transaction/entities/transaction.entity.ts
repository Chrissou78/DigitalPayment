import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from "typeorm";
import { TransactionEvent } from "./transaction-event.entity";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: [
    "PAYMENT", "CASH_IN", "CASH_OUT", "REMITTANCE_SEND",
    "REMITTANCE_COLLECT", "ADVANCE", "REFILL", "STAKING_REWARD",
    "WITHDRAWAL", "FEE"
  ]})
  type!: string;

  @Column({ type: "enum", enum: [
    "CREATED", "AUTHORIZED", "COMPLETED", "FAILED",
    "REVERSED", "SETTLED", "PENDING_PAYMENT"
  ], default: "CREATED" })
  status!: string;

  @Column("uuid", { nullable: true })
  merchantId!: string;

  @Column("uuid", { nullable: true })
  customerId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  fee!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  reserveAmount!: number;

  @Column({ length: 3, default: "ZAR" })
  currency!: string;

  @Column({ type: "text", nullable: true })
  qrPayload!: string;

  @Column({ length: 50, nullable: true })
  authCode!: string;

  @Column({ type: "enum", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], nullable: true })
  riskLevel!: string;

  @Column({ type: "int", nullable: true })
  riskScore!: number;

  @Column({ length: 100, nullable: true })
  customerRef!: string;

  @Column({ length: 100, nullable: true })
  merchantRef!: string;

  @Column({ length: 66, nullable: true })
  onChainBatchId!: string;

  @Column({ length: 66, nullable: true })
  onChainTxHash!: string;

  @Column({ type: "timestamptz", nullable: true })
  settledOnChainAt!: Date;

  @Column({ type: "jsonb", default: "{}" })
  metadata!: Record<string, any>;

  @OneToMany(() => TransactionEvent, (e) => e.transaction)
  events!: TransactionEvent[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}


