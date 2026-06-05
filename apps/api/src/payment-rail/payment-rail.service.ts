import { Injectable } from '@nestjs/common';
import { StitchService } from './stitch/stitch.service';
import { StitchPaymentResponse } from './stitch/stitch.types';

@Injectable()
export class PaymentRailService {
  constructor(private readonly stitch: StitchService) {}

  async initiateRefillPull(params: {
    amountCents: number;
    walletId: string;
    refillId: string;
    bankAccountId: string;
  }): Promise<StitchPaymentResponse> {
    return this.stitch.initiatePayment({
      amount: {
        quantity: (params.amountCents / 100).toFixed(2),
        currency: 'ZAR',
      },
      payerReference: `PDUKA-REFILL-${params.refillId.slice(0, 8)}`,
      beneficiaryReference: 'PayDuka Wallet Refill',
      externalReference: params.refillId,
      beneficiaryName: 'PayDuka (Pty) Ltd',
      beneficiaryBankId: 'fnb', // PayDuka's settlement bank
      beneficiaryAccountNumber: '62000000000', // PayDuka's pooled account
    });
  }

  async authorizeCard(params: {
    token: string;
    amount: number;
  }): Promise<{ authorized: boolean; authCode: string }> {
    // TODO: Integrate with card network (Visa/Mastercard) via Stitch in-person
    // For now, simulate authorization
    return { authorized: true, authCode: `AUTH_${Date.now().toString(36).toUpperCase()}` };
  }
}
