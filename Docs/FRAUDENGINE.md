# PayDuka — Fraud Detection Engine Specification

Version: 1.0

---

## Overview

The fraud engine is a synchronous middleware in the transaction lifecycle.
Every transaction is scored BEFORE any balance changes occur. The engine
returns a risk level (LOW/MEDIUM/HIGH) and a recommended action
(APPROVE/HOLD/REJECT).

Phase 1 uses a rule-based scoring system. ML-based models are introduced
in Phase 5 after sufficient labeled data accumulates.

---

## Scoring Methodology

Each transaction is evaluated against all active rules. Each triggered rule
contributes a weighted score. The total score (0-100) maps to a risk level:

| Score | Risk Level | Action |
|-------|-----------|--------|
| 0-30 | LOW | APPROVE — transaction proceeds immediately |
| 31-60 | MEDIUM | HOLD — transaction flagged for review, 24hr delay on advances |
| 61-100 | HIGH | REJECT — transaction blocked, fraud alert created |

---

## Rule Definitions

### Velocity Rules

**V1: Transaction frequency per customer**
- Trigger: >10 transactions in 1 hour from same customer wallet
- Weight: 20
- Rationale: Legitimate retail purchases rarely exceed this frequency

**V2: Transaction frequency per merchant**
- Trigger: >100 transactions in 1 hour to same merchant
- Weight: 10
- Rationale: High volume is normal for some merchants; this catches outliers

**V3: Rapid successive payments**
- Trigger: >3 transactions within 60 seconds from same customer
- Weight: 30
- Rationale: Near-impossible for legitimate physical retail QR payments

**V4: New account velocity**
- Trigger: >5 transactions within first 24 hours of account creation
- Weight: 15
- Rationale: New accounts with high activity are suspicious

### Amount Rules

**A1: Single transaction amount**
- Trigger: Transaction amount > R10,000 (or > 3x customer's average)
- Weight: 15
- Rationale: Unusually large transactions warrant additional scrutiny

**A2: Daily cumulative amount**
- Trigger: Customer's daily total > R25,000 (or > 5x daily average)
- Weight: 20
- Rationale: Sudden spending spikes may indicate account compromise

**A3: Amount just below KYC threshold**
- Trigger: Transaction amount between R4,500-R5,000 (just below Tier 1 limit)
- Weight: 25
- Rationale: Structuring to avoid KYC limits is a money laundering indicator

### Device Rules

**D1: New device**
- Trigger: Transaction from a device not previously registered to this user
- Weight: 15
- Rationale: Account takeover often comes from new devices

**D2: Multiple accounts per device**
- Trigger: Device fingerprint associated with >2 different user accounts
- Weight: 25
- Rationale: Multiple accounts on one device suggests synthetic identity fraud

**D3: Rooted/jailbroken device**
- Trigger: Device reports root or jailbreak indicators
- Weight: 10
- Rationale: Rooted devices bypass security controls

### Geolocation Rules

**G1: Location mismatch**
- Trigger: Transaction location >100km from customer's last known location
  AND <30 minutes since last transaction
- Weight: 20
- Rationale: Impossible travel speed indicates cloned credentials

**G2: Location mismatch with merchant**
- Trigger: Customer location >50km from merchant's registered address
  (for in-person payments)
- Weight: 10
- Rationale: In-person payments should be geographically proximate

### Behavior Rules

**B1: First transaction to merchant**
- Trigger: Customer has never transacted with this merchant before
- Weight: 5
- Rationale: Low weight, but contributes to composite scoring

**B2: Unusual time of day**
- Trigger: Transaction between 00:00-05:00 local time
- Weight: 10
- Rationale: Most retail transactions occur during business hours

**B3: P2P followed by immediate withdrawal**
- Trigger: Customer receives P2P transfer then requests withdrawal within 1 hour
- Weight: 30
- Rationale: Classic money laundering / mule account pattern

### Merchant-Specific Rules

**M1: New merchant high volume**
- Trigger: Merchant with <30 days history processing >R50,000/day
- Weight: 20
- Rationale: New merchants with sudden high volume may be fraudulent

**M2: Merchant chargeback spike**
- Trigger: Merchant's rolling 7-day chargeback rate exceeds 1%
- Weight: 35
- Rationale: High chargeback rate is the strongest fraud indicator

**M3: Uniform transaction amounts**
- Trigger: >80% of merchant's daily transactions are the exact same amount
- Weight: 20
- Rationale: Suggests manufactured transactions, not genuine retail activity

---

## Configuration Management

All rules are stored in the `fraud_rules` database table with configurable
thresholds. Rules can be enabled, disabled, or threshold-adjusted via the
admin dashboard WITHOUT code deployment. Changes take effect on the next
transaction (rules are loaded from cache with 60-second TTL).

---

## Escalation Procedures

**MEDIUM risk transactions:**
- Transaction proceeds but is flagged in the admin fraud queue
- If the transaction involves an advance, the advance is delayed 24 hours
- Merchant is notified: "This transaction is being reviewed"
- Risk analyst must review within 12 hours or it auto-approves

**HIGH risk transactions:**
- Transaction is blocked immediately
- Customer receives: "This payment could not be completed. Contact support."
- Merchant receives nothing (to prevent social engineering)
- Risk analyst is alerted immediately (push notification + email)
- Risk analyst must review within 4 hours
- If confirmed fraud: freeze the customer wallet, block the device,
  create incident report

**Merchant suspension triggers (automatic):**
- Rolling 90-day chargeback rate exceeds 2%
- 3 or more HIGH-risk transactions in 7 days
- KYC document found to be fraudulent
- Manual suspension by ADMINISTRATOR role