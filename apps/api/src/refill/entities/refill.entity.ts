import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { RefillStatus } from "../../common/enums/refill-status.enum";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("refills")
export class Refill {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  walletId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "enum", enum: RefillStatus, default: RefillStatus.INITIATED })
  status!: RefillStatus;

  @Column({ nullable: true })
  externalPaymentId!: string;

  @Column({ nullable: true })
  externalPaymentUrl!: string;

  @Column({ type: "timestamp", nullable: true })
  completedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
