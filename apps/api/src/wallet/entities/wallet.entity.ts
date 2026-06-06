import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index, OneToMany,
} from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';
import { WalletStatus } from '../../common/enums/wallet-status.enum';

@Entity('wallets')
@Index(['ownerId', 'ownerType'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerId: string; // merchantId or customerId

  @Column({ type: 'varchar', length: 20 })
  ownerType: 'MERCHANT' | 'CUSTOMER';

  @Column({ type: 'bigint', default: 0 })
  available: number; // ZAR cents

  @Column({ type: 'bigint', default: 0 })
  reserved: number; // ZAR cents

  @Column({ type: 'bigint', default: 0 })
  staked: number; // ZAR cents

  @Column({ type: 'varchar', length: 3, default: 'ZAR' })
  currency: string;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: string;

  @OneToMany(() => LedgerEntry, (entry) => entry.wallet)
  ledgerEntries?: LedgerEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
