# PayDuka — Database Schema Specification

Version: 1.0
Last Updated: 2026-06-05

---

## Design Principles

1. **Append-only ledger for all financial data.** Wallet balances are never stored
   as a mutable column. They are calculated from the sum of ledger entries.
2. **Event-sourced transactions.** Transaction records are immutable. State changes
   are recorded as separate TransactionEvent records.
3. **Soft deletes only.** No financial record is ever physically deleted. A
   `deleted_at` timestamp marks logical deletion.
4. **All monetary values in integer cents.** R10.50 is stored as 1050. Currency
   code stored alongside.
5. **All timestamps as `timestamptz` in UTC.**
6. **UUIDs for all primary keys.**
7. **Audit trail on every table** via `created_at`, `updated_at`, and
   `created_by`/`updated_by` where applicable.

---

## Core Tables

### users

The base identity table for all system participants (customers, merchants, admins).

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number    VARCHAR(20) NOT NULL UNIQUE,
    email           VARCHAR(255),
    password_hash   VARCHAR(255), -- bcrypt, nullable for customer-only accounts
    user_type       VARCHAR(20) NOT NULL, -- CUSTOMER, MERCHANT, ADMIN
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING_VERIFICATION',
                    -- PENDING_VERIFICATION, ACTIVE, SUSPENDED, DEACTIVATED
    kyc_tier        SMALLINT NOT NULL DEFAULT 0,
                    -- 0: Unverified, 1: Basic (phone), 2: Standard (ID),
                    -- 3: Full (enhanced DD)
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    id_number_enc   BYTEA, -- AES-256 encrypted national ID number
    date_of_birth   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_phone ON users(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_type_status ON users(user_type, status) WHERE deleted_at IS NULL;

merchants
Extended profile for merchant users.

CREATE TABLE merchants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    business_legal_name     VARCHAR(255) NOT NULL,
    business_trading_name   VARCHAR(255) NOT NULL,
    registration_number     VARCHAR(50),
    business_type           VARCHAR(50), -- SOLE_PROP, PTY_LTD, CC, etc.
    physical_address        JSONB, -- {line1, line2, city, province, postalCode}
    risk_tier               VARCHAR(20) NOT NULL DEFAULT 'NEW',
                            -- NEW, STANDARD, TRUSTED
    fee_tier                VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
                            -- STANDARD, GROWTH, ENTERPRISE
    onboarding_status       VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                            -- PENDING, DOCUMENTS_SUBMITTED, VERIFIED,
                            -- REJECTED, ACTIVE, SUSPENDED
    advance_eligible        BOOLEAN NOT NULL DEFAULT FALSE,
    advance_daily_cap_cents INTEGER DEFAULT 0, -- max advance per day in cents
    chargeback_rate         DECIMAL(5,4) DEFAULT 0.0000, -- rolling 90-day rate
    merchant_qr_code_id     VARCHAR(100) UNIQUE, -- unique QR identifier
    settlement_bank_account JSONB, -- {bankName, bankId, accountNumber, branchCode}
                                   -- encrypted fields within
    settlement_bank_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_merchant_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_merchants_user ON merchants(user_id);
CREATE INDEX idx_merchants_status ON merchants(onboarding_status);
CREATE INDEX idx_merchants_risk ON merchants(risk_tier);
CREATE INDEX idx_merchants_qr ON merchants(merchant_qr_code_id);

wallets
Every customer and merchant has exactly one wallet.

CREATE TABLE wallets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    wallet_type             VARCHAR(20) NOT NULL, -- CUSTOMER, MERCHANT, SYSTEM
    currency                VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                            -- ACTIVE, FROZEN, CLOSED
    auto_refill_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    auto_refill_threshold_cents  INTEGER DEFAULT 50000, -- R500 = 50000
    auto_refill_amount_cents     INTEGER DEFAULT 100000, -- R1000 = 100000
    auto_settlement_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    auto_settlement_threshold_cents INTEGER,
    auto_settlement_retain_cents    INTEGER,
    linked_bank_account     JSONB, -- {bankId, accountNumber, accountHolder, verified}
    debicheck_mandate_id    VARCHAR(100), -- Stitch DebiCheck mandate reference
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_refill ON wallets(auto_refill_enabled, status)
    WHERE auto_refill_enabled = TRUE AND status = 'ACTIVE';
wallet_ledger
The append-only financial ledger. This is the most important table in the system. Current balance = SUM(amount_cents) WHERE wallet_id = X AND entry_type IN ('CREDIT','DEBIT') grouped by balance_type.

CREATE TABLE wallet_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID NOT NULL REFERENCES wallets(id),
    transaction_id  UUID NOT NULL REFERENCES transactions(id),
    entry_type      VARCHAR(10) NOT NULL, -- CREDIT, DEBIT
    balance_type    VARCHAR(20) NOT NULL,
                    -- AVAILABLE, PENDING, RESERVED
    amount_cents    INTEGER NOT NULL, -- positive for CREDIT, negative for DEBIT
    currency        VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    description     VARCHAR(500) NOT NULL,
    running_balance_cents INTEGER NOT NULL, -- calculated balance after this entry
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_credit_positive CHECK (
        (entry_type = 'CREDIT' AND amount_cents > 0) OR
        (entry_type = 'DEBIT' AND amount_cents < 0)
    )
);

-- Critical indexes for balance calculation and transaction lookup
CREATE INDEX idx_ledger_wallet ON wallet_ledger(wallet_id, created_at DESC);
CREATE INDEX idx_ledger_wallet_balance ON wallet_ledger(wallet_id, balance_type);
CREATE INDEX idx_ledger_transaction ON wallet_ledger(transaction_id);
transactions
Core transaction record. Immutable once created — state changes tracked via transaction_events.

CREATE TABLE transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type    VARCHAR(30) NOT NULL,
                        -- WALLET_PAYMENT, BANK_PAYMENT, CARD_PAYMENT,
                        -- P2P_TRANSFER, WALLET_REFILL, MERCHANT_WITHDRAWAL,
                        -- ADVANCE_CREDIT, ADVANCE_RECOVERY, RESERVE_RELEASE,
                        -- FEE_COLLECTION
    current_status      VARCHAR(30) NOT NULL DEFAULT 'CREATED',
                        -- CREATED, PENDING_PAYMENT, AUTHORIZED, RISK_REVIEW,
                        -- PROCESSING, COMPLETED, FAILED, EXPIRED, REVERSED,
                        -- DISPUTED
    source_wallet_id    UUID REFERENCES wallets(id), -- nullable for card/bank inbound
    dest_wallet_id      UUID REFERENCES wallets(id), -- nullable for withdrawals
    amount_cents        INTEGER NOT NULL,
    fee_cents           INTEGER NOT NULL DEFAULT 0,
    advance_fee_cents   INTEGER NOT NULL DEFAULT 0,
    net_amount_cents    INTEGER NOT NULL, -- amount - fee - advance_fee
    currency            VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    payment_rail        VARCHAR(30), -- INTERNAL, PAYSHAP, CAPITEC_PAY,
                                     -- DEBICHECK, CARD_VISA, CARD_MC, EFT
    external_reference  VARCHAR(255), -- idempotency key sent to payment provider
    provider_reference  VARCHAR(255), -- reference returned by payment provider
    qr_payload          JSONB,        -- decoded QR code data
    risk_score          SMALLINT,     -- 0-100, set by fraud engine
    risk_level          VARCHAR(10),  -- LOW, MEDIUM, HIGH
    merchant_id         UUID REFERENCES merchants(id),
    metadata            JSONB DEFAULT '{}', -- extensible metadata
    expires_at          TIMESTAMPTZ,  -- for pending transactions (5 min TTL)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txn_status ON transactions(current_status, created_at DESC);
CREATE INDEX idx_txn_source ON transactions(source_wallet_id, created_at DESC);
CREATE INDEX idx_txn_dest ON transactions(dest_wallet_id, created_at DESC);
CREATE INDEX idx_txn_merchant ON transactions(merchant_id, created_at DESC);
CREATE INDEX idx_txn_external_ref ON transactions(external_reference);
CREATE INDEX idx_txn_provider_ref ON transactions(provider_reference);
CREATE INDEX idx_txn_expires ON transactions(expires_at)
    WHERE current_status IN ('CREATED', 'PENDING_PAYMENT');
CREATE INDEX idx_txn_type_status ON transactions(transaction_type, current_status);

transaction_events
Immutable event log for every transaction state change.

CREATE TABLE transaction_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id),
    event_type      VARCHAR(30) NOT NULL,
                    -- CREATED, PAYMENT_INITIATED, AUTHORIZED,
                    -- RISK_SCORED, RISK_ESCALATED, PROCESSING,
                    -- COMPLETED, FAILED, EXPIRED, REVERSED,
                    -- DISPUTED, ADVANCE_OFFERED, ADVANCE_ACCEPTED,
                    -- ADVANCE_SETTLED
    previous_status VARCHAR(30),
    new_status      VARCHAR(30) NOT NULL,
    event_data      JSONB DEFAULT '{}', -- event-specific payload
    triggered_by    VARCHAR(50), -- SYSTEM, USER:{id}, ADMIN:{id}, WEBHOOK:{provider}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txn_events_txn ON transaction_events(transaction_id, created_at);
CREATE INDEX idx_txn_events_type ON transaction_events(event_type, created_at DESC);
advances
Tracks card payment advance settlements.

CREATE TABLE advances (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id          UUID NOT NULL REFERENCES transactions(id),
    merchant_id             UUID NOT NULL REFERENCES merchants(id),
    merchant_wallet_id      UUID NOT NULL REFERENCES wallets(id),
    card_authorization_code VARCHAR(50) NOT NULL,
    gross_amount_cents      INTEGER NOT NULL, -- original card transaction amount
    card_fee_cents          INTEGER NOT NULL, -- estimated card processing fee
    net_settlement_cents    INTEGER NOT NULL, -- expected from card network
    advance_fee_cents       INTEGER NOT NULL, -- PayDuka's advance fee
    advance_amount_cents    INTEGER NOT NULL, -- credited to merchant
    advance_fee_rate        DECIMAL(5,4) NOT NULL, -- e.g., 0.0150 = 1.5%
    status                  VARCHAR(20) NOT NULL DEFAULT 'OUTSTANDING',
                            -- OUTSTANDING, SETTLED, WRITTEN_OFF, REVERSED
    expected_settlement_date DATE,
    actual_settlement_date  DATE,
    settlement_amount_cents INTEGER, -- actual amount received from card network
    settlement_reference    VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_advances_merchant ON advances(merchant_id, status);
CREATE INDEX idx_advances_status ON advances(status, expected_settlement_date);
CREATE INDEX idx_advances_txn ON advances(transaction_id);
merchant_reserves
Tracks rolling reserves held against merchant balances.

CREATE TABLE merchant_reserves (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    transaction_id      UUID NOT NULL REFERENCES transactions(id),
    reserve_amount_cents INTEGER NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'HELD',
                        -- HELD, RELEASED, CONSUMED (used for chargeback)
    release_date        DATE NOT NULL, -- 30 days after transaction for wallet,
                                       -- 90 days for card
    released_at         TIMESTAMPTZ,
    consumed_reason     VARCHAR(255), -- reason if consumed (chargeback ref, etc.)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reserves_merchant ON merchant_reserves(merchant_id, status);
CREATE INDEX idx_reserves_release ON merchant_reserves(status, release_date)
    WHERE status = 'HELD';
fraud_rules
Configurable fraud detection rules.

CREATE TABLE fraud_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name       VARCHAR(100) NOT NULL UNIQUE,
    rule_category   VARCHAR(30) NOT NULL,
                    -- VELOCITY, AMOUNT, DEVICE, GEOLOCATION, BEHAVIOR
    description     TEXT NOT NULL,
    rule_config     JSONB NOT NULL,
                    -- {threshold, window_seconds, weight, action}
                    -- e.g., {"max_txns_per_hour": 20, "weight": 15,
                    --         "action": "ADD_SCORE"}
    weight          SMALLINT NOT NULL DEFAULT 10, -- score contribution 0-100
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
fraud_assessments
Record of fraud scoring for each transaction.

CREATE TABLE fraud_assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id),
    total_score     SMALLINT NOT NULL, -- 0-100
    risk_level      VARCHAR(10) NOT NULL, -- LOW (0-30), MEDIUM (31-60), HIGH (61-100)
    rules_triggered JSONB NOT NULL DEFAULT '[]',
                    -- [{rule_id, rule_name, score_contribution, details}]
    action_taken    VARCHAR(30) NOT NULL,
                    -- APPROVED, HELD_FOR_REVIEW, REJECTED
    reviewed_by     UUID REFERENCES users(id), -- admin who reviewed if HELD
    review_notes    TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_txn ON fraud_assessments(transaction_id);
CREATE INDEX idx_fraud_risk ON fraud_assessments(risk_level, created_at DESC);
CREATE INDEX idx_fraud_review ON fraud_assessments(action_taken, created_at)
    WHERE action_taken = 'HELD_FOR_REVIEW';
devices
Track customer and merchant devices for fraud detection.

CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    device_id       VARCHAR(255) NOT NULL, -- device fingerprint hash
    device_type     VARCHAR(20), -- ANDROID, IOS
    device_model    VARCHAR(100),
    os_version      VARCHAR(50),
    app_version     VARCHAR(20),
    push_token      VARCHAR(500), -- FCM/APNS push notification token
    is_trusted      BOOLEAN NOT NULL DEFAULT FALSE,
    last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ip         INET,
    last_location   JSONB, -- {lat, lng, accuracy}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_user_device UNIQUE(user_id, device_id)
);

CREATE INDEX idx_devices_user ON devices(user_id);
kyc_documents
KYC verification documents uploaded by merchants and customers.

CREATE TABLE kyc_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    document_type   VARCHAR(30) NOT NULL,
                    -- NATIONAL_ID, PROOF_OF_ADDRESS, BUSINESS_REGISTRATION,
                    -- BANK_STATEMENT, SELFIE, TAX_CERTIFICATE
    s3_key          VARCHAR(500) NOT NULL, -- S3 object key (encrypted at rest)
    file_name       VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        -- PENDING, APPROVED, REJECTED
    verified_by     UUID REFERENCES users(id), -- admin who verified
    rejection_reason VARCHAR(500),
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_user ON kyc_documents(user_id, document_type);
CREATE INDEX idx_kyc_status ON kyc_documents(verification_status)
    WHERE verification_status = 'PENDING';
audit_logs
Comprehensive audit trail for all system operations.

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID, -- user who performed the action (null for SYSTEM)
    actor_type      VARCHAR(20) NOT NULL, -- CUSTOMER, MERCHANT, ADMIN, SYSTEM
    action          VARCHAR(50) NOT NULL,
                    -- e.g., MERCHANT_CREATED, WALLET_DEBITED, ADVANCE_APPROVED,
                    -- KYC_VERIFIED, FRAUD_ALERT_REVIEWED, SETTLEMENT_INITIATED
    resource_type   VARCHAR(30) NOT NULL, -- MERCHANT, TRANSACTION, WALLET, etc.
    resource_id     UUID NOT NULL,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
system_wallets
Internal PayDuka wallets for fee collection, advance pool, etc.

CREATE TABLE system_wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_name     VARCHAR(50) NOT NULL UNIQUE,
                    -- FEE_REVENUE, ADVANCE_POOL, RESERVE_POOL, FLOAT_POOL
    currency        VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System wallets also use wallet_ledger for their balance tracking.
-- The wallet_id in wallet_ledger can reference either wallets.id
-- or system_wallets.id. We use a unified approach:
-- system wallets are inserted into the wallets table with
-- wallet_type = 'SYSTEM' and a null user_id.
webhook_events
Raw webhook payloads for debugging and replay.

CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        VARCHAR(30) NOT NULL, -- STITCH, MPESA
    event_type      VARCHAR(50) NOT NULL,
    event_id        VARCHAR(255) NOT NULL, -- provider's event ID for deduplication
    payload         JSONB NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
                      -- RECEIVED, PROCESSING, PROCESSED, FAILED
    error_message   TEXT,
    attempts        SMALLINT NOT NULL DEFAULT 0,
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_webhook_event UNIQUE(provider, event_id)
);

CREATE INDEX idx_webhook_status ON webhook_events(processing_status)
    WHERE processing_status IN ('RECEIVED', 'FAILED');
refill_attempts
Track auto-refill attempts for debugging and analytics.

CREATE TABLE refill_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID NOT NULL REFERENCES wallets(id),
    transaction_id  UUID REFERENCES transactions(id),
    trigger_type    VARCHAR(20) NOT NULL, -- REACTIVE, PROACTIVE
    trigger_reason  VARCHAR(100), -- e.g., "balance_below_threshold_after_payment"
    amount_cents    INTEGER NOT NULL,
    payment_rail    VARCHAR(30), -- PAYSHAP, DEBICHECK
    status          VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
                    -- INITIATED, PAYMENT_PENDING, COMPLETED, FAILED,
                    -- INSUFFICIENT_FUNDS, MANDATE_EXPIRED
    failure_reason  VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_refill_wallet ON refill_attempts(wallet_id, created_at DESC);
CREATE INDEX idx_refill_status ON refill_attempts(status, created_at)
    WHERE status IN ('INITIATED', 'PAYMENT_PENDING');
Materialized Views
mv_merchant_daily_summary
Refreshed every 15 minutes for dashboard performance.

CREATE MATERIALIZED VIEW mv_merchant_daily_summary AS
SELECT
    t.merchant_id,
    DATE(t.created_at) AS txn_date,
    t.transaction_type,
    COUNT(*) AS txn_count,
    SUM(t.amount_cents) AS total_amount_cents,
    SUM(t.fee_cents) AS total_fees_cents,
    SUM(t.advance_fee_cents) AS total_advance_fees_cents,
    COUNT(*) FILTER (WHERE t.current_status = 'COMPLETED') AS completed_count,
    COUNT(*) FILTER (WHERE t.current_status = 'FAILED') AS failed_count
FROM transactions t
WHERE t.merchant_id IS NOT NULL
GROUP BY t.merchant_id, DATE(t.created_at), t.transaction_type;

CREATE UNIQUE INDEX idx_mv_merchant_daily
    ON mv_merchant_daily_summary(merchant_id, txn_date, transaction_type);
mv_wallet_balance
Pre-computed wallet balances refreshed every 5 minutes. Used ONLY for read operations (dashboards, balance display). All write operations (payments, refills) MUST compute balance from the ledger in real-time within the transaction.

CREATE MATERIALIZED VIEW mv_wallet_balance AS
SELECT
    wallet_id,
    balance_type,
    SUM(amount_cents) AS balance_cents,
    MAX(created_at) AS last_entry_at
FROM wallet_ledger
GROUP BY wallet_id, balance_type;

CREATE UNIQUE INDEX idx_mv_balance ON mv_wallet_balance(wallet_id, balance_type);
Database Maintenance
Partition Strategy (Phase 3+)
When transaction volume exceeds 1M rows/month, partition the following tables by month on created_at:

transactions
transaction_events
wallet_ledger
audit_logs
webhook_events
Index Maintenance
Run REINDEX on high-churn indexes weekly during off-peak hours. Run VACUUM ANALYZE daily. Monitor index bloat via pg_stat_user_indexes.