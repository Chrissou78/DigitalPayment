import {
  IsEnum,
  IsInt,
  IsPositive,
  IsUUID,
  IsOptional,
  IsString,
} from "class-validator";
import { TransactionType } from "../../common/enums/transaction-type.enum";

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsUUID()
  merchantId!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  qrPayload?: string;

  @IsOptional()
  @IsString()
  cardToken?: string;

  @IsOptional()
  @IsUUID()
  customerWalletId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
