import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";

@Entity("customers")
export class Customer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  phone!: string;

  @Column()
  pinHash!: string;

  @Column({ length: 100 })
  firstName!: string;

  @Column({ length: 100 })
  lastName!: string;

  @Column({ length: 20, nullable: true })
  idNumber!: string;

  @Column({ type: "enum", enum: ["TIER_0", "TIER_1", "TIER_2"], default: "TIER_0" })
  kycTier!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "jsonb", default: "{}" })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
