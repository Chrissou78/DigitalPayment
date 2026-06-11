import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn,
} from "typeorm";

@Entity("fraud_alerts")
export class FraudAlert {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid", { nullable: true })
  transactionId!: string;

  @Column("uuid", { nullable: true })
  merchantId!: string;

  @Column("uuid", { nullable: true })
  customerId!: string;

  @Column({ type: "enum", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] })
  riskLevel!: string;

  @Column({ type: "int" })
  riskScore!: number;

  @Column({ length: 500 })
  reason!: string;

  @Column({ type: "jsonb", default: "{}" })
  details!: Record<string, any>;

  @Column({ type: "boolean", default: false })
  resolved!: boolean;

  @Column({ nullable: true })
  resolvedBy!: string;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt!: Date;

  @Column({ length: 500, nullable: true })
  resolutionNote!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
