import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("advances")
export class Advance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  merchantId!: string;

  @Column("uuid")
  transactionId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  originalAmount!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  advanceAmount!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  advanceFee!: number;

  @Column({ type: "enum", enum: ["ELIGIBLE", "OUTSTANDING", "SETTLED", "OVERDUE", "DEDUCTED"], default: "OUTSTANDING" })
  status!: string;

  @Column({ type: "bigint", nullable: true, transformer: bigintTransformer })
  settledAmount!: number;

  @Column({ type: "timestamptz", nullable: true })
  settledAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  overdueAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
