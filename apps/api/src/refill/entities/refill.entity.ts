import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("refills")
export class Refill {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  walletId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "enum", enum: ["INITIATED", "PENDING_PAYMENT", "COMPLETED", "FAILED", "REQUIRES_MANUAL_REVIEW"], default: "INITIATED" })
  status!: string;

  @Column({ nullable: true })
  paymentId!: string;

  @Column({ length: 500, nullable: true })
  paymentUrl!: string;

  @Column({ nullable: true })
  stitchRef!: string;

  @Column({ type: "int", default: 0 })
  retryCount!: number;

  @Column({ length: 500, nullable: true })
  errorMessage!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
