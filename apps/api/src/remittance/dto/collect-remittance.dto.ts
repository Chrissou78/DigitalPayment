import { IsString } from 'class-validator';

export class CollectRemittanceDto {
  @IsString()
  collectionCode: string;

  @IsString()
  recipientPhone: string;
}
