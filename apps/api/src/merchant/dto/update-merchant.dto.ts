import { PartialType } from '@nestjs/common';
import { CreateMerchantDto } from './create-merchant.dto';

export class UpdateMerchantDto extends PartialType(CreateMerchantDto) {}
