export interface StitchPaymentRequest {
  amount: { quantity: string; currency: string };
  payerReference: string;
  beneficiaryReference: string;
  externalReference: string;
  beneficiaryName: string;
  beneficiaryBankId: string;
  beneficiaryAccountNumber: string;
}

export interface StitchPaymentResponse {
  id: string;
  url: string;
  status: string;
}

export interface StitchTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
