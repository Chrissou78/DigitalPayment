import { IsIn, IsUUID, IsInt, Min, IsOptional, IsString, IsObject } from "class-validator";

export class CreateTransactionDto {
  @IsIn([
    "PAYMENT", "CASH_IN", "CASH_OUT", "REMITTANCE_SEND",
    "REMITTANCE_COLLECT", "ADVANCE", "REFILL", "STAKING_REWARD",
    "WITHDRAWAL", "FEE",
  ])
  type!: string;

  @IsUUID()
  merchantId!: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsOptional()
  customerRef?: string;

  @IsString()
  @IsOptional()
  merchantRef?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
