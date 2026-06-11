import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("cash_ins")
export class CashIn {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  merchantId!: string;

  @Column()
  customerPhone!: string;

  @Column("uuid", { nullable: true })
  customerId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  customerFee!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  merchantCommission!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  protocolFee!: number;

  @Column({ type: "enum", enum: ["INITIATED", "CONFIRMED", "COMPLETED", "CANCELLED", "FAILED"], default: "INITIATED" })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
