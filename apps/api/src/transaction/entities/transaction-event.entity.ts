import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { TransactionStatus } from '../../common/enums/transaction-status.enum';

@Entity('transaction_events')
export class TransactionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  transactionId: string;

  @ManyToOne(() => Transaction, (t) => t.events)
  @JoinColumn({ name: 'transactionId' })
  transaction: Transaction;

  @Column({ type: 'enum', enum: TransactionStatus })
  status: TransactionStatus;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
