import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { RefillModule } from '../refill/refill.module';
import { SettlementModule } from '../settlement/settlement.module';

@Module({
  imports: [RefillModule, SettlementModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
