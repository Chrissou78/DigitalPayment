export interface CashInFeeTier {
  minAmount: number;  // cents
  maxAmount: number;  // cents
  customerFee: number; // cents
  merchantCommission: number; // cents
  protocolFee: number; // cents
}

export interface CashInFeeSchedule {
  tiers: CashInFeeTier[];
}
