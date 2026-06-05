import { IsUUID, IsInt, IsPositive, IsString, IsOptional } from 'class-validator';

export class CreateCashInDto {
  @IsString()
  customerIdentifier: string; // phone number or wallet ID

  @IsInt()
  @IsPositive()
  amount: number; // cents — the cash amount

  @IsOptional()
  metadata?: Record<string, any>;
}
