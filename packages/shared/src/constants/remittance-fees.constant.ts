import { RemittanceFeeTier } from '../interfaces/remittance-fees.interface';

export const REMITTANCE_FEE_TIERS: RemittanceFeeTier[] = [
  { minAmount: 100,    maxAmount: 20000,   senderFee: 500,  sendingMerchantCommission: 150, receivingMerchantCommission: 150, protocolFee: 200 },
  { minAmount: 20001,  maxAmount: 50000,   senderFee: 800,  sendingMerchantCommission: 250, receivingMerchantCommission: 250, protocolFee: 300 },
  { minAmount: 50001,  maxAmount: 150000,  senderFee: 1200, sendingMerchantCommission: 350, receivingMerchantCommission: 350, protocolFee: 500 },
  { minAmount: 150001, maxAmount: 500000,  senderFee: 2000, sendingMerchantCommission: 600, receivingMerchantCommission: 600, protocolFee: 800 },
];
