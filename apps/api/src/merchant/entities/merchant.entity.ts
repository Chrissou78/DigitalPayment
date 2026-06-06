import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ unique: true })
  apiKey: string;

  @Column()
  apiSecretHash: string;

  @Column({ default: false })
  kycVerified: boolean;

  @Column({ type: 'jsonb', nullable: true })
  kycData: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  trailingVolume30d: number; // cents

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  chargebackRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
