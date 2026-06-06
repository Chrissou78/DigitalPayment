import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { CashInStatus } from "@payduka/shared";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("cash_in_transactions")
export class CashIn {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  agentMerchantId!: string;

  @Column("uuid")
  agentWalletId!: string;

  @Column("uuid")
  customerWalletId!: string;

  @Column({ nullable: true })
  customerPhone!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  depositAmount!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  customerFee!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  merchantCommission!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  protocolFee!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  netCreditAmount!: number;

  @Column({ type: "enum", enum: CashInStatus, default: CashInStatus.PENDING })
  status!: CashInStatus;

  @Column({ nullable: true })
  confirmationCode!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
