import {
  Entity, PrimaryGeneratedColumn, Column,
} from "typeorm";
import { bigintTransformer } from "../../common/transformers/bigint.transformer";

@Entity("settlement_batches")
export class SettlementBatch {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "int" })
  batchNonce!: number;

  @Column({ type: "int" })
  transactionCount!: number;

  @Column({ type: "bigint", transformer: bigintTransformer })
  totalVolumeZarCents!: number;

  @Column({ nullable: true })
  totalVolumeTokens!: string;

  @Column({ nullable: true })
  burnAmountTokens!: string;

  @Column({ nullable: true })
  treasuryAmountTokens!: string;

  @Column({ nullable: true })
  pdukaZarRate!: string;

  @Column({ length: 66 })
  onChainTxHash!: string;

  @Column({ type: "bigint", nullable: true, transformer: bigintTransformer })
  blockNumber!: number;

  @Column({ type: "timestamptz", default: () => "now()" })
  settledAt!: Date;
}
