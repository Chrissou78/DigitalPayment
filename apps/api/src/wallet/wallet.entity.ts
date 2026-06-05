import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("wallets")
export class Wallet {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  @Index()
  ownerId: string; // merchantId or customerId

  @Column({ type: "varchar", length: 20 })
  ownerType: "MERCHANT" | "CUSTOMER";

  @Column({ type: "int", default: 0 })
  available: number; // ZAR cents

  @Column({ type: "int", default: 0 })
  reserved: number; // ZAR cents (rolling reserve for merchants)

  @Column({ type: "int", default: 0 })
  staked: number; // ZAR cents (earning APY)

  @Column({ type: "varchar", length: 3, default: "ZAR" })
  currency: string;

  @Column({ type: "varchar", length: 20, default: "ACTIVE" })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
