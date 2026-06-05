import { Module } from '@nestjs/common';
import { PaymentRailService } from './payment-rail.service';
import { StitchService } from './stitch/stitch.service';

@Module({
  providers: [PaymentRailService, StitchService],
  exports: [PaymentRailService],
})
export class PaymentRailModule {}
