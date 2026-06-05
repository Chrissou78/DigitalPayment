import { FraudService } from './fraud.service';

describe('FraudService', () => {
  let service: FraudService;

  beforeEach(() => {
    service = new FraudService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('score', () => {
    it('returns LOW for normal transaction', async () => {
      const result = await service.score({
        amount: 50000,     // R500
        merchantId: 'merch-1',
        customerId: 'cust-1',
        type: 'PAYMENT',
      });

      expect(result.riskLevel).toBe('LOW');
      expect(result.pass).toBe(true);
      expect(result.score).toBeLessThan(50);
    });

    it('flags HIGH for very large amount', async () => {
      const result = await service.score({
        amount: 50000000,  // R500,000
        merchantId: 'merch-1',
        customerId: 'cust-1',
        type: 'PAYMENT',
      });

      expect(result.riskLevel).toBe('HIGH');
      expect(result.pass).toBe(false);
    });
  });
});
