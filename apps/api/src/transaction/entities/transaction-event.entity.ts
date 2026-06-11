import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { Transaction } from "./transaction.entity";

@Entity("transaction_events")
export class TransactionEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  transactionId!: string;

  @ManyToOne(() => Transaction, (t) => t.events)
  @JoinColumn({ name: "transaction_id" })
  transaction!: Transaction;

  @Column({ length: 50 })
  event!: string;

  @Column({ type: "jsonb", default: "{}" })
  data!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
