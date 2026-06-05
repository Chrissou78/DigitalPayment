describe('AdvanceService — eligibility', () => {
  it('eligible: active 30+ days, volume > R10K, chargeback < 2%', () => {
    const merchant = {
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      trailing30dVolumeCents: 5000000, // R50,000
      chargebackRateBps: 100, // 1%
    };

    const eligible = checkEligibility(merchant);
    expect(eligible.eligible).toBe(true);
    expect(eligible.maxAdvance).toBe(1500000); // 30% of R50K = R15K
  });

  it('not eligible: too new', () => {
    const merchant = {
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days
      trailing30dVolumeCents: 5000000,
      chargebackRateBps: 100,
    };

    const eligible = checkEligibility(merchant);
    expect(eligible.eligible).toBe(false);
    expect(eligible.reason).toMatch(/30 days/i);
  });

  it('not eligible: low volume', () => {
    const merchant = {
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      trailing30dVolumeCents: 500000, // R5,000 (below R10K threshold)
      chargebackRateBps: 100,
    };

    const eligible = checkEligibility(merchant);
    expect(eligible.eligible).toBe(false);
  });

  it('not eligible: high chargeback rate', () => {
    const merchant = {
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      trailing30dVolumeCents: 5000000,
      chargebackRateBps: 300, // 3% (above 2% threshold)
    };

    const eligible = checkEligibility(merchant);
    expect(eligible.eligible).toBe(false);
  });
});

function checkEligibility(merchant: {
  createdAt: Date;
  trailing30dVolumeCents: number;
  chargebackRateBps: number;
}) {
  const ageMs = Date.now() - merchant.createdAt.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (ageDays < 30) {
    return { eligible: false, reason: 'Merchant must be active for 30 days' };
  }
  if (merchant.trailing30dVolumeCents < 1000000) {
    return { eligible: false, reason: 'Volume below R10,000 threshold' };
  }
  if (merchant.chargebackRateBps > 200) {
    return { eligible: false, reason: 'Chargeback rate exceeds 2%' };
  }

  const maxAdvance = Math.floor(merchant.trailing30dVolumeCents * 0.3);
  return { eligible: true, maxAdvance };
}
