// apps/api/src/merchant/dto/create-merchant.dto.ts
import { IsString, IsEmail, IsNotEmpty, IsOptional } from "class-validator";

export class CreateMerchantDto {
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  pin!: string;

  @IsOptional()
  @IsString()
  tradingName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}
