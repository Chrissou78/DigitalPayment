import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  apiSecret: string;
}
