import { IsInt, IsPositive, IsOptional, IsString } from 'class-validator';

export class ConfigureRefillDto {
  @IsOptional() @IsInt() @IsPositive()
  threshold?: number; // cents

  @IsOptional() @IsInt() @IsPositive()
  amount?: number; // cents

  @IsOptional() @IsString()
  linkedBankAccountId?: string;
}
