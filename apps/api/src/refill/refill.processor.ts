import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RefillService } from './refill.service';

@Processor('refill')
export class RefillProcessor extends WorkerHost {
  private readonly logger = new Logger(RefillProcessor.name);

  constructor(private readonly refillService: RefillService) {
    super();
  }

  async process(job: Job<{ walletId: string }>): Promise<any> {
    this.logger.log(`Processing refill job ${job.id} for wallet ${job.data.walletId}`);

    const result = await this.refillService.processRefill(job.data.walletId);

    return result
      ? { refillId: result.id, status: result.status }
      : { skipped: true };
  }
}
