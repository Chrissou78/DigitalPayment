import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { LedgerEntry } from './ledger-entry.entity';
import { WalletStatus } from '../../common/enums/wallet-status.enum';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  merchantId: string;

  @OneToOne(() => Merchant, (m) => m.wallet)
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @Column({ type: 'bigint', default: 0 })
  availableBalance: number; // stored in cents

  @Column({ type: 'bigint', default: 0 })
  reservedBalance: number; // stored in cents

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  @Column({ type: 'int', default: 50000 })
  refillThreshold: number; // cents — triggers auto-refill below this

  @Column({ type: 'int', default: 100000 })
  refillAmount: number; // cents — how much to refill

  @Column({ nullable: true })
  linkedBankAccountId: string; // Stitch bank account reference

  @OneToMany(() => LedgerEntry, (entry) => entry.wallet)
  ledgerEntries: LedgerEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
