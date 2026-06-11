// apps/api/src/merchant/entities/merchant.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("merchants")
export class Merchant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 255 })
  businessName!: string;

  @Column({ length: 255, nullable: true })
  tradingName!: string;

  @Column({ length: 50, nullable: true })
  registrationNumber!: string;

  @Column({ length: 20, unique: true })
  phone!: string;

  @Column({ length: 255, nullable: true })
  email!: string;

  @Column({ length: 255, nullable: true })
  addressLine1!: string;

  @Column({ length: 255, nullable: true })
  addressLine2!: string;

  @Column({ length: 100, nullable: true })
  city!: string;

  @Column({ length: 50, nullable: true })
  province!: string;

  @Column({ length: 10, nullable: true })
  postalCode!: string;

  @Column({ length: 3, default: "ZAF" })
  country!: string;

  @Column({ length: 64, unique: true })
  apiKey!: string;

  @Column({ length: 255 })
  apiSecretHash!: string;

  @Column({ length: 255 })
  pinHash!: string;

  @Column({ type: "enum", enum: ["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"], default: "PENDING" })
  status!: string;

  @Column({ type: "enum", enum: ["TIER_0", "TIER_1", "TIER_2"], default: "TIER_0" })
  kycTier!: string;

  @Column({ name: "trailing_30d_volume_cents", type: "bigint", default: 0, transformer: bigintTransformer })
  trailing30dVolumeCents!: number;

  @Column({ name: "chargeback_rate_bps", type: "int", default: 0 })
  chargebackRateBps!: number;

  @Column({ type: "jsonb", default: "{}" })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
