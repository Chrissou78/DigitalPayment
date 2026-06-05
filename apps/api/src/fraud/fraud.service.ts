import { Injectable, Logger } from '@nestjs/common';

export interface FraudResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number; // 0-100
  flags: string[];
  approved: boolean;
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  async evaluate(params: {
    merchantId: string;
    customerId?: string;
    amount: number;
    type: string;
    metadata?: Record<string, any>;
  }): Promise<FraudResult> {
    const flags: string[] = [];
    let score = 0;

    // Rule 1: High-value transaction
    if (params.amount > 500000) {
      // R5,000+
      score += 20;
      flags.push('HIGH_VALUE');
    }

    // Rule 2: Very high value
    if (params.amount > 2000000) {
      // R20,000+
      score += 30;
      flags.push('VERY_HIGH_VALUE');
    }

    // TODO: Add velocity checks (Redis-backed sliding window)
    // TODO: Add device fingerprint checks
    // TODO: Add geolocation anomaly detection
    // TODO: Add merchant history scoring

    const riskLevel = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
    const approved = riskLevel !== 'HIGH';

    this.logger.log(
      `Fraud check: merchant=${params.merchantId} amount=${params.amount} ` +
      `score=${score} risk=${riskLevel} approved=${approved}`,
    );

    return { riskLevel, score, flags, approved };
  }
}
