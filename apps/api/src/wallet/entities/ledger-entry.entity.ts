import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { LedgerEntryType } from '@payduka/shared';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  walletId: string;

  @ManyToOne(() => Wallet, (w) => w.ledgerEntries)
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({ type: 'enum', enum: LedgerEntryType })
  type: LedgerEntryType;

  @Column({ type: 'bigint' })
  amount: number; // cents, positive = credit, negative = debit

  @Column({ type: 'bigint' })
  balanceAfter: number; // cents

  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceType: string | null;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
