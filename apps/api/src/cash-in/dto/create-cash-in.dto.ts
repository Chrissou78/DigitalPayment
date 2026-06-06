import {
  IsInt,
  IsPositive,
  IsString,
  IsOptional,
} from "class-validator";

export class CreateCashInDto {
  @IsString()
  customerIdentifier!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
