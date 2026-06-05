import { CashInFeeTier } from '../interfaces/cash-in-fees.interface';

// All amounts in cents (ZAR)
export const CASH_IN_FEE_TIERS: CashInFeeTier[] = [
  { minAmount: 100,    maxAmount: 10000,   customerFee: 200,  merchantCommission: 150, protocolFee: 50 },
  { minAmount: 10001,  maxAmount: 50000,   customerFee: 500,  merchantCommission: 350, protocolFee: 150 },
  { minAmount: 50001,  maxAmount: 100000,  customerFee: 800,  merchantCommission: 550, protocolFee: 250 },
  { minAmount: 100001, maxAmount: 300000,  customerFee: 1500, merchantCommission: 1000, protocolFee: 500 },
  { minAmount: 300001, maxAmount: 500000,  customerFee: 2500, merchantCommission: 1700, protocolFee: 800 },
];
