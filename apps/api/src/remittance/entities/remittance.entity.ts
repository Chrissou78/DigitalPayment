import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { RemittanceStatus } from '@payduka/shared';

@Entity('remittances')
export class Remittance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Sender side
  @Column('uuid')
  senderMerchantId: string; // merchant where sender deposited cash

  @Column('uuid')
  senderMerchantWalletId: string;

  @Column({ nullable: true })
  senderPhone: string;

  @Column({ nullable: true })
  senderName: string;

  // Recipient side
  @Column()
  recipientPhone: string;

  @Column({ nullable: true })
  recipientName: string;

  @Column('uuid', { nullable: true })
  recipientWalletId: string;

  @Column('uuid', { nullable: true })
  collectingMerchantId: string; // merchant where recipient collects

  @Column('uuid', { nullable: true })
  collectingMerchantWalletId: string;

  // Amounts
  @Column({ type: 'bigint' })
  sendAmount: number; // cents — cash handed in by sender

  @Column({ type: 'bigint' })
  senderFee: number;

  @Column({ type: 'bigint' })
  sendingMerchantCommission: number;

  @Column({ type: 'bigint' })
  receivingMerchantCommission: number;

  @Column({ type: 'bigint' })
  protocolFee: number;

  @Column({ type: 'bigint' })
  recipientAmount: number; // what recipient actually gets

  // Collection
  @Column({ length: 8 })
  collectionCode: string; // unique code for recipient to collect

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // collection code expiry (72 hours)

  @Column({ type: 'enum', enum: RemittanceStatus, default: RemittanceStatus.INITIATED })
  status: RemittanceStatus;

  @Column({ type: 'timestamp', nullable: true })
  collectedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
