# PayDuka — Database Schema Specification

Version: 2.0
Last Updated: 2026-06-06

This document describes the database as it is actually built by the migration at
`apps/api/src/migrations/1717600000000-InitialSchema.ts`. That migration is the
authoritative schema. If this document and the migration ever disagree, the
migration wins and this document is wrong.

> Schema history note (v2.0): earlier drafts of this document described a single
> `users` table and a `wallet_ledger` table with `balance_type` columns. That
> model was never built. The implemented schema uses separate `merchants` and
> `customers` tables, a virtual-account `wallets` table keyed by
> `(owner_id, owner_type)`, and an append-only `ledger_entries` table. This
> version documents what exists.

---

## Design Principles

1. **Virtual accounts.** Every merchant and customer has exactly one wallet,
   identified by `(owner_id, owner_type)`. Balances are stored as three columns
   in ZAR cents: `available`, `reserved`, `staked`.
2. **Append-only ledger.** Every balance change writes one immutable row to
   `ledger_entries`, recording the signed amount and the resulting balance, in
   the same transaction that moved the balance.
3. **Accounting split.** A ledger entry records two things: the accounting
   primitive in `type` (DEBIT, CREDIT, RESERVE_HOLD, etc.) and the business
   context in `reference_type` (PAYMENT, REMITTANCE, CASH_IN, etc.) with an
   optional `reference_id`. Type answers "what kind of movement"; reference
   answers "because of what".
4. **All monetary values are integer cents.** R10.50 is stored as `1050`.
   Balance columns are `BIGINT`.
5. **All timestamps are `timestamptz` in UTC.**
6. **UUID primary keys** via `uuid_generate_v4()`.
7. **Immutable transactions.** Transaction rows are not mutated for history;
   state changes are appended to `transaction_events`.

---

## Enum Types

The migration creates these Postgres enum types up front.

| Enum | Values |
|------|--------|
| `wallet_owner_type` | MERCHANT, CUSTOMER |
| `wallet_status` | ACTIVE, FROZEN, CLOSED |
| `transaction_type` | PAYMENT, CASH_IN, CASH_OUT, REMITTANCE_SEND, REMITTANCE_COLLECT, ADVANCE, REFILL, STAKING_REWARD, WITHDRAWAL, FEE |
| `transaction_status` | CREATED, AUTHORIZED, COMPLETED, FAILED, REVERSED, SETTLED, PENDING_PAYMENT |
| `ledger_entry_type` | DEBIT, CREDIT, RESERVE_HOLD, RESERVE_RELEASE, STAKE_LOCK, STAKE_UNLOCK, STAKING_REWARD, FEE_REVENUE, ADVANCE_CREDIT, ADVANCE_RECOVERY |
| `advance_status` | ELIGIBLE, OUTSTANDING, SETTLED, OVERDUE, DEDUCTED |
| `refill_status` | INITIATED, PENDING_PAYMENT, COMPLETED, FAILED, REQUIRES_MANUAL_REVIEW |
| `cash_in_status` | INITIATED, CONFIRMED, COMPLETED, CANCELLED, FAILED |
| `remittance_status` | ESCROWED, COLLECTED, EXPIRED, CANCELLED, FAILED |
| `kyc_tier` | TIER_0, TIER_1, TIER_2 |
| `kyc_review_status` | PENDING, APPROVED, REJECTED |
| `merchant_status` | PENDING, ACTIVE, SUSPENDED, CLOSED |
| `fraud_risk_level` | LOW, MEDIUM, HIGH, CRITICAL |

The `ledger_entry_type` enum is mirrored exactly by the TypeScript
`LedgerEntryType` enum in `packages/shared`. They must stay in lockstep.

---

## Tables

The migration creates 15 tables. They are grouped here by purpose.

### Identity: `merchants`, `customers`, `admin_users`

There is no single `users` table. Merchants and customers are separate.

`merchants`
```sql
CREATE TABLE merchants (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name             VARCHAR(255) NOT NULL,
  trading_name              VARCHAR(255),
  registration_number       VARCHAR(50),
  phone                     VARCHAR(20) NOT NULL UNIQUE,
  email                     VARCHAR(255),
  address_line1             VARCHAR(255),
  address_line2             VARCHAR(255),
  city                      VARCHAR(100),
  province                  VARCHAR(50),
  postal_code               VARCHAR(10),
  country                   VARCHAR(3) DEFAULT 'ZAF',
  api_key                   VARCHAR(64) NOT NULL UNIQUE,
  api_secret_hash           VARCHAR(255) NOT NULL,
  pin_hash                  VARCHAR(255) NOT NULL,
  status                    merchant_status NOT NULL DEFAULT 'PENDING',
  kyc_tier                  kyc_tier NOT NULL DEFAULT 'TIER_0',
  trailing_30d_volume_cents BIGINT NOT NULL DEFAULT 0,
  chargeback_rate_bps       INT NOT NULL DEFAULT 0,
  metadata                  JSONB DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_merchants_phone, idx_merchants_status, idx_merchants_api_key
```
`trailing_30d_volume_cents` and `chargeback_rate_bps` (basis points) feed advance
eligibility and risk tiering.

`customers`
```sql
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(20) NOT NULL UNIQUE,
  pin_hash    VARCHAR(255) NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  id_number   VARCHAR(20),
  kyc_tier    kyc_tier NOT NULL DEFAULT 'TIER_0',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_customers_phone
```

`admin_users`
```sql
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
The second migration seeds one `SUPER_ADMIN` row from
`ADMIN_DEFAULT_EMAIL`/`ADMIN_DEFAULT_PASSWORD`.

### Money core: `wallets`, `ledger_entries`

`wallets` — one virtual account per owner.
```sql
CREATE TABLE wallets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL,
  owner_type  wallet_owner_type NOT NULL,
  available   BIGINT NOT NULL DEFAULT 0,
  reserved    BIGINT NOT NULL DEFAULT 0,
  staked      BIGINT NOT NULL DEFAULT 0,
  currency    VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  status      wallet_status NOT NULL DEFAULT 'ACTIVE',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_available_non_negative CHECK (available >= 0),
  CONSTRAINT chk_reserved_non_negative  CHECK (reserved  >= 0),
  CONSTRAINT chk_staked_non_negative    CHECK (staked    >= 0)
);
CREATE UNIQUE INDEX idx_wallets_owner ON wallets(owner_id, owner_type);
CREATE INDEX idx_wallets_status ON wallets(status);
```
- `available` — spendable balance.
- `reserved` — merchant rolling reserve held against chargebacks.
- `staked` — earning yield, not spendable until unstaked.
- The unique `(owner_id, owner_type)` index enforces one wallet per owner and is
  how the backend looks a wallet up (`WalletService.findByMerchantId`).
- Check constraints make a negative balance impossible at the database level.

`ledger_entries` — the append-only money log. This is the most important table.
```sql
CREATE TABLE ledger_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id      UUID NOT NULL REFERENCES wallets(id),
  type           ledger_entry_type NOT NULL,
  amount         BIGINT NOT NULL,          -- signed: negative on debit
  balance_after  BIGINT NOT NULL,          -- resulting balance for the affected bucket
  reference_type VARCHAR(50),              -- business context (PAYMENT, REMITTANCE, ...)
  reference_id   UUID,                     -- id of the related record (txn, remittance, ...)
  description    VARCHAR(500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ledger_wallet  ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_created ON ledger_entries(created_at);
CREATE INDEX idx_ledger_ref     ON ledger_entries(reference_type, reference_id);
```
The accounting split lives here. For example, a customer paying a merchant
produces a `DEBIT` entry with `reference_type = PAYMENT` on the customer wallet,
and a `CREDIT` entry with `reference_type = PAYMENT` on the merchant wallet. A
rolling-reserve hold is a `RESERVE_HOLD` with `reference_type = PAYMENT`. A
platform fee is `FEE_REVENUE` with `reference_type = FEE`. Staking writes
`STAKE_LOCK`/`STAKE_UNLOCK`/`STAKING_REWARD` with `reference_type = STAKING`.

`balance_after` is written by `WalletService` against the bucket the entry
affects (reserved for `RESERVE_HOLD`, otherwise available). Balances are stored
on `wallets` for speed; the ledger is the audit trail and reconciliation source.

### Payments: `transactions`, `transaction_events`

`transactions` — immutable payment record.
```sql
CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                transaction_type NOT NULL,
  status              transaction_status NOT NULL DEFAULT 'CREATED',
  merchant_id         UUID REFERENCES merchants(id),
  customer_id         UUID REFERENCES customers(id),
  amount              BIGINT NOT NULL,
  fee                 BIGINT NOT NULL DEFAULT 0,
  reserve_amount      BIGINT NOT NULL DEFAULT 0,
  currency            VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  qr_payload          TEXT,
  auth_code           VARCHAR(50),
  risk_level          fraud_risk_level,
  risk_score          INT,
  customer_ref        VARCHAR(100),
  merchant_ref        VARCHAR(100),
  on_chain_batch_id   VARCHAR(66),
  on_chain_tx_hash    VARCHAR(66),
  settled_on_chain_at TIMESTAMPTZ,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- indexes on merchant_id, customer_id, status, type, created_at, on_chain_batch_id
-- partial index idx_txn_unsettled WHERE on_chain_batch_id IS NULL AND status = 'COMPLETED'
```
The partial `idx_txn_unsettled` index is what the on-chain settlement bridge
scans each hour to find completed transactions not yet batched.

`transaction_events` — append-only state log.
```sql
CREATE TABLE transaction_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  event          VARCHAR(50) NOT NULL,
  data           JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_txn_events_txn
```

### Product flows: `advances`, `refills`, `cash_ins`, `remittances`

`advances` — same-day card advance.
```sql
CREATE TABLE advances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id     UUID NOT NULL REFERENCES merchants(id),
  transaction_id  UUID NOT NULL REFERENCES transactions(id),
  original_amount BIGINT NOT NULL,
  advance_amount  BIGINT NOT NULL,
  advance_fee     BIGINT NOT NULL,
  status          advance_status NOT NULL DEFAULT 'OUTSTANDING',
  settled_amount  BIGINT,
  settled_at      TIMESTAMPTZ,
  overdue_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_advances_merchant, idx_advances_status, idx_advances_txn
```

`refills` — auto top-up attempts.
```sql
CREATE TABLE refills (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id     UUID NOT NULL REFERENCES wallets(id),
  amount        BIGINT NOT NULL,
  status        refill_status NOT NULL DEFAULT 'INITIATED',
  payment_id    VARCHAR(255),
  payment_url   VARCHAR(500),
  stitch_ref    VARCHAR(255),
  retry_count   INT NOT NULL DEFAULT 0,
  error_message VARCHAR(500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_refills_wallet, idx_refills_status, idx_refills_payment
```

`cash_ins` — agent cash deposits.
```sql
CREATE TABLE cash_ins (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id         UUID NOT NULL REFERENCES merchants(id),
  customer_phone      VARCHAR(20) NOT NULL,
  customer_id         UUID REFERENCES customers(id),
  amount              BIGINT NOT NULL,
  customer_fee        BIGINT NOT NULL DEFAULT 0,
  merchant_commission BIGINT NOT NULL DEFAULT 0,
  protocol_fee        BIGINT NOT NULL DEFAULT 0,
  status              cash_in_status NOT NULL DEFAULT 'INITIATED',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_cashin_merchant, idx_cashin_phone, idx_cashin_status, idx_cashin_created
```

`remittances` — send and collect via tracking code, with escrow.
```sql
CREATE TABLE remittances (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_code               VARCHAR(20) NOT NULL UNIQUE,
  sender_phone                VARCHAR(20) NOT NULL,
  sender_id                   UUID REFERENCES customers(id),
  recipient_phone             VARCHAR(20) NOT NULL,
  recipient_id                UUID REFERENCES customers(id),
  send_merchant_id            UUID REFERENCES merchants(id),
  collect_merchant_id         UUID REFERENCES merchants(id),
  amount                      BIGINT NOT NULL,
  sender_fee                  BIGINT NOT NULL DEFAULT 0,
  send_merchant_commission    BIGINT NOT NULL DEFAULT 0,
  collect_merchant_commission BIGINT NOT NULL DEFAULT 0,
  protocol_fee                BIGINT NOT NULL DEFAULT 0,
  status                      remittance_status NOT NULL DEFAULT 'ESCROWED',
  expires_at                  TIMESTAMPTZ,
  collected_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_remit_code, idx_remit_sender, idx_remit_recipient, idx_remit_status, idx_remit_created
```

### Risk, compliance, settlement, audit

`fraud_alerts` — persisted risk flags for review.
```sql
CREATE TABLE fraud_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id  UUID REFERENCES transactions(id),
  merchant_id     UUID REFERENCES merchants(id),
  customer_id     UUID REFERENCES customers(id),
  risk_level      fraud_risk_level NOT NULL,
  risk_score      INT NOT NULL,
  reason          VARCHAR(500) NOT NULL,
  details         JSONB DEFAULT '{}',
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by     VARCHAR(255),
  resolved_at     TIMESTAMPTZ,
  resolution_note VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_fraud_resolved, idx_fraud_level, idx_fraud_created
```
Note: the fraud rules themselves are currently in code (see `FRAUDENGINE.md`),
not a `fraud_rules` table. This table stores the resulting alerts.

`kyc_reviews` — tier-upgrade review queue.
```sql
CREATE TABLE kyc_reviews (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  requested_tier   kyc_tier NOT NULL,
  id_number        VARCHAR(20),
  id_photo_url     VARCHAR(500),
  selfie_url       VARCHAR(500),
  status           kyc_review_status NOT NULL DEFAULT 'PENDING',
  reviewed_by      VARCHAR(255),
  reviewed_at      TIMESTAMPTZ,
  rejection_reason VARCHAR(500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_kyc_customer, idx_kyc_status
```

`settlement_batches` — on-chain settlement record.
```sql
CREATE TABLE settlement_batches (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_nonce            INT NOT NULL,
  transaction_count      INT NOT NULL,
  total_volume_zar_cents BIGINT NOT NULL,
  total_volume_tokens    VARCHAR(78),
  burn_amount_tokens     VARCHAR(78),
  treasury_amount_tokens VARCHAR(78),
  pduka_zar_rate         VARCHAR(78),
  on_chain_tx_hash       VARCHAR(66) NOT NULL,
  block_number           BIGINT,
  settled_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_batch_nonce, idx_batch_hash
```
Token-amount columns are `VARCHAR(78)` to hold full-precision 256-bit integers
as strings.

`audit_log` — system-wide audit trail.
```sql
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type    VARCHAR(20) NOT NULL,    -- CUSTOMER, MERCHANT, ADMIN, SYSTEM
  actor_id      UUID,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id   UUID,
  details       JSONB DEFAULT '{}',
  ip_address    VARCHAR(45),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- idx_audit_actor, idx_audit_resource, idx_audit_created
```

---

## Balance integrity

Balances live on `wallets` and are protected three ways:

1. **Check constraints** prevent any bucket from going negative.
2. **Pessimistic row locks.** `WalletService.debit`/`credit` select the wallet
   `FOR UPDATE` before mutating, so concurrent payments serialise.
3. **Ledger reconciliation.** Summing `ledger_entries.amount` for a wallet,
   grouped by the affected bucket, must equal the stored balance. Any drift is a
   bug and is detectable.

---

## Column naming

Entities use camelCase fields (`ownerId`, `referenceType`); the database uses
snake_case columns (`owner_id`, `reference_type`). This mapping relies on a
snake-case naming strategy in the TypeORM data source. Confirm that strategy is
configured before pointing the API at a real Postgres instance; the unit tests
mock the repositories and do not exercise the mapping.

---

## Migrations & operations

- The schema is owned by migrations, not by `synchronize`. The runtime config
  sets `synchronize=false` in production and runs compiled migrations on startup
  (`migrationsRun=true`).
- Run migrations locally with the API workspace's `migration:run` script after
  bringing up Postgres via `pnpm infra:up`.
- **Partitioning (future).** When `transactions`, `transaction_events`,
  `ledger_entries`, or `audit_log` exceed ~1M rows/month, partition by month on
  `created_at`.
- **Routine maintenance.** `VACUUM ANALYZE` daily; monitor index bloat via
  `pg_stat_user_indexes`; `REINDEX` high-churn indexes during off-peak windows.
