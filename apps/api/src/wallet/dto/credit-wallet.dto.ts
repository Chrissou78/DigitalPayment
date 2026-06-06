import { IsUUID, IsInt, IsPositive, IsEnum, IsOptional, IsString } from 'class-validator';
import { LedgerEntryType } from '@payduka/shared';

export class CreditWalletDto {
  @IsUUID()
  walletId: string;

  @IsInt() @IsPositive()
  amount: number; // cents

  @IsEnum(LedgerEntryType)
  type: LedgerEntryType;

  @IsOptional() @IsUUID()
  transactionId?: string;

  @IsOptional() @IsString()
  description?: string;
}
