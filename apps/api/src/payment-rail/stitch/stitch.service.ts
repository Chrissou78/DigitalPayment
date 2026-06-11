import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient, gql } from 'graphql-request';
import {
  StitchPaymentRequest,
  StitchPaymentResponse,
  StitchTokenResponse,
} from './stitch.types';

@Injectable()
export class StitchService {
  private readonly logger = new Logger(StitchService.name);
  private client: GraphQLClient;
  private accessToken: string = "";
  private tokenExpiry: number = 0;

  constructor(private readonly config: ConfigService) {
    this.client = new GraphQLClient(
      this.config.get('STITCH_API_URL', 'https://api.stitch.money/graphql'),
    );
  }

  private async authenticate(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;

    const response = await fetch('https://login.stitch.money/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.get('STITCH_CLIENT_ID'),
        client_secret: this.config.get('STITCH_CLIENT_SECRET'),
        audience: 'https://api.stitch.money/graphql',
      }),
    });

    const data: StitchTokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // 1 min buffer
    this.client.setHeader('Authorization', `Bearer ${this.accessToken}`);

    this.logger.log('Stitch API authenticated');
  }

  async initiatePayment(req: StitchPaymentRequest): Promise<StitchPaymentResponse> {
    await this.authenticate();

    const mutation = gql`
      mutation CreatePaymentRequest(
        $amount: MoneyInput!
        $payerReference: String!
        $beneficiaryReference: String!
        $externalReference: String
        $beneficiaryName: String!
        $beneficiaryBankId: BankBeneficiaryBankId!
        $beneficiaryAccountNumber: String!
      ) {
        clientPaymentInitiationRequestCreate(
          input: {
            amount: $amount
            payerReference: $payerReference
            beneficiaryReference: $beneficiaryReference
            externalReference: $externalReference
            beneficiary: {
              bankAccount: {
                name: $beneficiaryName
                bankId: $beneficiaryBankId
                accountNumber: $beneficiaryAccountNumber
              }
            }
          }
        ) {
          paymentInitiationRequest {
            id
            url
          }
        }
      }
    `;

    const data = await this.client.request(mutation, {
      amount: req.amount,
      payerReference: req.payerReference,
      beneficiaryReference: req.beneficiaryReference,
      externalReference: req.externalReference,
      beneficiaryName: req.beneficiaryName,
      beneficiaryBankId: req.beneficiaryBankId,
      beneficiaryAccountNumber: req.beneficiaryAccountNumber,
    });

    const result = (data as any).clientPaymentInitiationRequestCreate.paymentInitiationRequest;
    this.logger.log(`Stitch payment initiated: ${result.id}`);

    return { id: result.id, url: result.url, status: 'PENDING' };
  }
}
