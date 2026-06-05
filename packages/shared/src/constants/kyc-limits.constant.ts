import { KycTier } from '../enums/kyc-tier.enum';

export const KYC_LIMITS: Record<KycTier, { dailyLimit: number; monthlyLimit: number }> = {
  [KycTier.TIER_0]: { dailyLimit: 100000,  monthlyLimit: 500000 },   // R1,000 / R5,000
  [KycTier.TIER_1]: { dailyLimit: 500000,  monthlyLimit: 2500000 },  // R5,000 / R25,000
  [KycTier.TIER_2]: { dailyLimit: 2500000, monthlyLimit: 10000000 }, // R25,000 / R100,000
};
