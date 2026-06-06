import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { AdvanceStatus } from "../../common/enums/advance-status.enum";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("advances")
export class Advance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  merchantId!: string;

  @Column("uuid")
  transactionId!: string;

  @Column("uuid")
  merchantWalletId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  principal!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  fee!: number;

  @Column({ type: "enum", enum: AdvanceStatus, default: AdvanceStatus.OUTSTANDING })
  status!: AdvanceStatus;

  @Column({ type: "timestamp", nullable: true })
  settledAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
