export interface RemittanceFeeTier {
  minAmount: number;
  maxAmount: number;
  senderFee: number;
  sendingMerchantCommission: number;
  receivingMerchantCommission: number;
  protocolFee: number;
}
