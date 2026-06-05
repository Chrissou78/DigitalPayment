import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { TransactionStatus } from '../../common/enums/transaction-status.enum';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { TransactionEvent } from './transaction-event.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.CREATED })
  status: TransactionStatus;

  @Column('uuid')
  merchantId: string;

  @Column('uuid', { nullable: true })
  customerWalletId: string;

  @Column('uuid')
  merchantWalletId: string;

  @Column({ type: 'bigint' })
  amount: number; // cents

  @Column({ type: 'bigint', default: 0 })
  fee: number; // cents

  @Column({ type: 'bigint', default: 0 })
  reserveAmount: number; // cents

  @Column({ nullable: true })
  authCode: string;

  @Column({ nullable: true })
  externalPaymentId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => TransactionEvent, (e) => e.transaction)
  events: TransactionEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
