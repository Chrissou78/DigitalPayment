import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { AdvanceStatus } from '../../common/enums/advance-status.enum';

@Entity('advances')
export class Advance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  merchantId: string;

  @Column('uuid')
  transactionId: string; // the card txn this advance is against

  @Column('uuid')
  merchantWalletId: string;

  @Column({ type: 'bigint' })
  principal: number; // cents

  @Column({ type: 'bigint' })
  fee: number; // cents

  @Column({ type: 'enum', enum: AdvanceStatus, default: AdvanceStatus.OUTSTANDING })
  status: AdvanceStatus;

  @Column({ type: 'timestamp', nullable: true })
  settledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
