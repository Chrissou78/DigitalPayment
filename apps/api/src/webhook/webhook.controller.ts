import {
  Controller, Post, Body, Headers,
  HttpCode, HttpStatus, Logger, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RefillService } from '../refill/refill.service';
import { SettlementService } from '../settlement/settlement.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly refillService: RefillService,
    private readonly settlementService: SettlementService,
    private readonly config: ConfigService,
  ) {}

  @Post('stitch')
  @HttpCode(HttpStatus.OK)
  async handleStitchWebhook(
    @Body() body: any,
    @Headers('x-stitch-signature') signature: string,
  ) {
    // Verify webhook signature
    const secret = this.config.get('STITCH_WEBHOOK_SECRET');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expected) {
      this.logger.warn('Invalid Stitch webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(`Stitch webhook received: type=${body.type} id=${body.data?.id}`);

    switch (body.type) {
      case 'payment.completed':
        // Could be a refill or card settlement
        await this.refillService.completeRefill(body.data.id);
        break;

      case 'payment.settled':
        await this.settlementService.processCardSettlement(
          body.data.id,
          Math.round(parseFloat(body.data.amount.quantity) * 100),
        );
        break;

      case 'payment.failed':
        this.logger.warn(`Payment failed: ${body.data.id}`);
        // TODO: Handle failed refills/settlements
        break;

      default:
        this.logger.log(`Unhandled webhook type: ${body.type}`);
    }

    return { received: true };
  }
}
