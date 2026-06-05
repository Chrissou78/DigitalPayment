import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMerchantDto {
  @IsString() @IsNotEmpty()
  businessName: string;

  @IsEmail()
  email: string;

  @IsOptional() @IsString()
  phone?: string;
}
