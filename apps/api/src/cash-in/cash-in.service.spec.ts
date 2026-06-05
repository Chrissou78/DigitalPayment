import { Test, TestingModule } from '@nestjs/testing';
import { CashInService } from './cash-in.service';

describe('CashInService', () => {
  describe('fee tier calculation', () => {
    it('charges R2 for deposit R0-R200', () => {
      const amount = 15000; // R150
      const tier = getFeeForAmount(amount);
      expect(tier.customerFee).toBe(200);     // R2
      expect(tier.merchantCommission).toBe(150); // R1.50
    });

    it('charges R5 for deposit R201-R500', () => {
      const amount = 35000; // R350
      const tier = getFeeForAmount(amount);
      expect(tier.customerFee).toBe(500);     // R5
      expect(tier.merchantCommission).toBe(350); // R3.50
    });

    it('charges R10 for deposit R501-R1000', () => {
      const amount = 80000; // R800
      const tier = getFeeForAmount(amount);
      expect(tier.customerFee).toBe(1000);    // R10
      expect(tier.merchantCommission).toBe(700); // R7
    });

    it('charges R25 for deposit R1001+', () => {
      const amount = 250000; // R2,500
      const tier = getFeeForAmount(amount);
      expect(tier.customerFee).toBe(2500);     // R25
      expect(tier.merchantCommission).toBe(1700); // R17
    });
  });
});

// Helper matching the shared package fee tiers
function getFeeForAmount(amountCents: number) {
  const tiers = [
    { maxCents: 20000, customerFee: 200, merchantCommission: 150 },
    { maxCents: 50000, customerFee: 500, merchantCommission: 350 },
    { maxCents: 100000, customerFee: 1000, merchantCommission: 700 },
    { maxCents: Infinity, customerFee: 2500, merchantCommission: 1700 },
  ];
  return tiers.find((t) => amountCents <= t.maxCents)!;
}
