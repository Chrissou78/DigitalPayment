import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { TransactionStatus } from "../../common/enums/transaction-status.enum";
import { TransactionType } from "../../common/enums/transaction-type.enum";
import { TransactionEvent } from "./transaction-event.entity";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: TransactionType })
  type!: TransactionType;

  @Column({ type: "enum", enum: TransactionStatus, default: TransactionStatus.CREATED })
  status!: TransactionStatus;

  @Column("uuid")
  merchantId!: string;

  @Column("uuid", { nullable: true })
  customerWalletId!: string;

  @Column("uuid")
  merchantWalletId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  fee!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  reserveAmount!: number;

  @Column({ nullable: true })
  authCode!: string;

  @Column({ nullable: true })
  externalPaymentId!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, any>;

  @OneToMany(() => TransactionEvent, (e) => e.transaction)
  events!: TransactionEvent[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
