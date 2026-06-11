import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("remittances")
export class Remittance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true, length: 20 })
  trackingCode!: string;

  @Column()
  senderPhone!: string;

  @Column("uuid", { nullable: true })
  senderId!: string;

  @Column()
  recipientPhone!: string;

  @Column("uuid", { nullable: true })
  recipientId!: string;

  @Column("uuid", { nullable: true })
  sendMerchantId!: string;

  @Column("uuid", { nullable: true })
  collectMerchantId!: string;

  @Column({ type: "bigint", transformer: bigintTransformer })
  amount!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  senderFee!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  sendMerchantCommission!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  collectMerchantCommission!: number;

  @Column({ type: "bigint", default: 0, transformer: bigintTransformer })
  protocolFee!: number;

  @Column({ type: "enum", enum: ["ESCROWED", "COLLECTED", "EXPIRED", "CANCELLED", "FAILED"], default: "ESCROWED" })
  status!: string;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  collectedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
