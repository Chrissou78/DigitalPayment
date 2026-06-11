# PayDuka — Fraud & Risk Engine

Version: 2.0
Last Updated: 2026-06-06

This document describes the fraud engine as implemented in
`apps/api/src/fraud/fraud.service.ts`, and the roadmap for hardening it.

> Status note (v2.0): the engine is a synchronous, in-memory rules scorer. The
> richer model in earlier drafts (a configurable `fraud_rules` table, velocity
> and device rules) is roadmap, not current behaviour. What persists today is
> the resulting alert in the `fraud_alerts` table; the rules themselves live in
> code. This document marks implemented versus planned clearly.

---

## 1. What it does today

`FraudService.score()` takes a transaction context and returns a verdict:

```ts
score(params: {
  merchantId: string;
  customerId?: string;
  amount: number;            // ZAR cents
  type: string;
  metadata?: Record<string, any>;
}): Promise<FraudResult>

interface FraudResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;             // 0-100
  flags: string[];
  pass: boolean;             // false when riskLevel is HIGH
}
```

The score starts at 0 and accumulates from the rules below. The level is derived
from the score, and `pass` is simply "not HIGH". A transaction that does not pass
is blocked by the caller.

---

## 2. Implemented rules (amount-based)

| Rule | Condition | Score added | Flag |
|------|-----------|-------------|------|
| High value | amount > 500,000 cents (R5,000) | +20 | `HIGH_VALUE` |
| Very high value | amount > 2,000,000 cents (R20,000) | +30 | `VERY_HIGH_VALUE` |
| Extreme value | amount > 10,000,000 cents (R100,000) | +30 | `EXTREME_VALUE` |

Rules are cumulative. A R500,000 payment (50,000,000 cents) triggers all three:
20 + 30 + 30 = 80.

---

## 3. Score thresholds

| Score | Risk level | Outcome |
|-------|-----------|---------|
| 0-29 | LOW | pass |
| 30-59 | MEDIUM | pass (flagged) |
| 60-100 | HIGH | blocked (`pass = false`) |

Worked examples, matching the unit tests:

- **R500 (50,000 cents):** no rule fires, score 0, LOW, pass.
- **R500,000 (50,000,000 cents):** all three rules, score 80, HIGH, blocked.

The `fraud_risk_level` database enum also defines `CRITICAL`, reserved for a
future tier; the current scorer emits only LOW, MEDIUM, and HIGH.

---

## 4. Where the verdict goes

- The transaction flow reads `pass`. If false, the payment is rejected before any
  balance moves.
- `risk_level` and `risk_score` are recorded on the `transactions` row.
- A flagged or blocked transaction can be persisted to `fraud_alerts`
  (transaction/merchant/customer ids, level, score, reason, details) for the
  admin review queue. Alerts carry a `resolved` flag and resolution metadata.

---

## 5. Roadmap (planned, not yet implemented)

The service marks these as TODOs. They are the next layers of defence:

1. **Velocity checks** — Redis-backed sliding windows: transactions per minute,
   hour, and day per customer, per merchant, and per device. Sudden spikes add
   score.
2. **Device fingerprinting** — new or untrusted device adds score; known good
   device reduces it.
3. **Geolocation anomalies** — impossible travel, mismatched region, high-risk
   geographies.
4. **Merchant history scoring** — chargeback rate (`chargeback_rate_bps`),
   account age, trailing volume deviation.
5. **Configurable rules** — move thresholds and weights out of code into a
   `fraud_rules` table so they can be tuned without a deploy.
6. **A CRITICAL tier** — for example confirmed-stolen-instrument signals, that
   not only blocks but freezes the wallet and opens an alert automatically.

---

## 6. Design intent

- **Fail safe.** A blocked transaction never moves money; the balance check and
  the fraud check both run before any debit.
- **Explainable.** Every verdict carries the flags that produced it, so a
  reviewer can see exactly why a transaction scored the way it did.
- **Cheap and synchronous now, async-capable later.** Amount rules are O(1) and
  inline. Velocity and device rules will read from Redis and can be added without
  changing the verdict contract.
- **Tunable later without code changes** once rules move to the database.
