import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { CashInStatus } from '@payduka/shared';

@Entity('cash_in_transactions')
export class CashIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  agentMerchantId: string; // the merchant processing the deposit

  @Column('uuid')
  agentWalletId: string;

  @Column('uuid')
  customerWalletId: string;

  @Column({ nullable: true })
  customerPhone: string;

  @Column({ type: 'bigint' })
  depositAmount: number; // cents — the cash amount handed over

  @Column({ type: 'bigint' })
  customerFee: number;

  @Column({ type: 'bigint' })
  merchantCommission: number;

  @Column({ type: 'bigint' })
  protocolFee: number;

  @Column({ type: 'bigint' })
  netCreditAmount: number; // what the customer wallet actually receives

  @Column({ type: 'enum', enum: CashInStatus, default: CashInStatus.PENDING })
  status: CashInStatus;

  @Column({ nullable: true })
  confirmationCode: string; // SMS code sent to customer

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
