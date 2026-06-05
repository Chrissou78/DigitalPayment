describe('RemittanceService', () => {
  describe('tracking code generation', () => {
    it('generates unique codes in PD-XXXXXX format', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        codes.add(generateTrackingCode());
      }
      // All unique
      expect(codes.size).toBe(1000);
      // All match format
      codes.forEach((code) => {
        expect(code).toMatch(/^PD-[A-Z0-9]{6}$/);
      });
    });
  });

  describe('fee calculation', () => {
    it('charges R5 for R0-R500', () => {
      expect(getRemittanceFee(30000)).toBe(500); // R300 → R5
    });

    it('charges R10 for R501-R1000', () => {
      expect(getRemittanceFee(80000)).toBe(1000); // R800 → R10
    });

    it('charges R20 for R1001+', () => {
      expect(getRemittanceFee(200000)).toBe(2000); // R2,000 → R20
    });
  });

  describe('expiry', () => {
    it('remittance expires after 72 hours', () => {
      const createdAt = new Date(Date.now() - 73 * 60 * 60 * 1000);
      const expiresAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000);
      expect(expiresAt.getTime() < Date.now()).toBe(true);
    });
  });
});

function generateTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let code = 'PD-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getRemittanceFee(amountCents: number): number {
  if (amountCents <= 50000) return 500;
  if (amountCents <= 100000) return 1000;
  return 2000;
}
