import { IsUUID, IsString } from 'class-validator';

export class ConfirmCashInDto {
  @IsUUID()
  cashInId: string;

  @IsString()
  confirmationCode: string;
}
