import {
  IsString,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsObject,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateRemittanceDto {
  @IsPhoneNumber()
  recipientPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  senderName?: string;

  @IsOptional()
  @IsPhoneNumber()
  senderPhone?: string;

  @IsString()
  @MaxLength(3)
  currency!: string; // ISO 4217, e.g. 'USD'

  @IsInt()
  @Min(1)
  @Max(100_000_00) // adjust to your business limit
  amount!: number; // cents

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
