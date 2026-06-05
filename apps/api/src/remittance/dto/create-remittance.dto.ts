import { IsString, IsInt, IsPositive, IsOptional } from 'class-validator';

export class CreateRemittanceDto {
  @IsString()
  recipientPhone: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsInt()
  @IsPositive()
  amount: number; // cents

  @IsOptional()
  metadata?: Record<string, any>;
}
