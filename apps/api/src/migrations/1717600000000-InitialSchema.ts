import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1717600000000 implements MigrationInterface {
  name = 'InitialSchema1717600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Extensions ──
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── ENUM Types ──
    await queryRunner.query(`
      CREATE TYPE wallet_owner_type AS ENUM ('MERCHANT', 'CUSTOMER');
      CREATE TYPE wallet_status AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
      CREATE TYPE transaction_type AS ENUM (
        'PAYMENT', 'CASH_IN', 'CASH_OUT', 'REMITTANCE_SEND',
        'REMITTANCE_COLLECT', 'ADVANCE', 'REFILL', 'STAKING_REWARD',
        'WITHDRAWAL', 'FEE'
      );
      CREATE TYPE transaction_status AS ENUM (
        'CREATED', 'AUTHORIZED', 'COMPLETED', 'FAILED',
        'REVERSED', 'SETTLED', 'PENDING_PAYMENT'
      );
      CREATE TYPE ledger_entry_type AS ENUM (
        'DEBIT', 'CREDIT', 'RESERVE_HOLD', 'RESERVE_RELEASE',
        'STAKE_LOCK', 'STAKE_UNLOCK', 'STAKING_REWARD',
        'FEE_REVENUE', 'ADVANCE_CREDIT', 'ADVANCE_RECOVERY'
      );
      CREATE TYPE advance_status AS ENUM (
        'ELIGIBLE', 'OUTSTANDING', 'SETTLED', 'OVERDUE', 'DEDUCTED'
      );
      CREATE TYPE refill_status AS ENUM (
        'INITIATED', 'PENDING_PAYMENT', 'COMPLETED', 'FAILED',
        'REQUIRES_MANUAL_REVIEW'
      );
      CREATE TYPE cash_in_status AS ENUM (
        'INITIATED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED'
      );
      CREATE TYPE remittance_status AS ENUM (
        'ESCROWED', 'COLLECTED', 'EXPIRED', 'CANCELLED', 'FAILED'
      );
      CREATE TYPE kyc_tier AS ENUM ('TIER_0', 'TIER_1', 'TIER_2');
      CREATE TYPE kyc_review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      CREATE TYPE merchant_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
      CREATE TYPE fraud_risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    `);

    // ── Merchants ──
    await queryRunner.query(`
      CREATE TABLE merchants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        business_name VARCHAR(255) NOT NULL,
        trading_name VARCHAR(255),
        registration_number VARCHAR(50),
        phone VARCHAR(20) NOT NULL UNIQUE,
        email VARCHAR(255),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        province VARCHAR(50),
        postal_code VARCHAR(10),
        country VARCHAR(3) DEFAULT 'ZAF',
        api_key VARCHAR(64) NOT NULL UNIQUE,
        api_secret_hash VARCHAR(255) NOT NULL,
        pin_hash VARCHAR(255) NOT NULL,
        status merchant_status NOT NULL DEFAULT 'PENDING',
        kyc_tier kyc_tier NOT NULL DEFAULT 'TIER_0',
        trailing_30d_volume_cents BIGINT NOT NULL DEFAULT 0,
        chargeback_rate_bps INT NOT NULL DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_merchants_phone ON merchants(phone)`);
    await queryRunner.query(`CREATE INDEX idx_merchants_status ON merchants(status)`);
    await queryRunner.query(`CREATE INDEX idx_merchants_api_key ON merchants(api_key)`);

    // ── Customers ──
    await queryRunner.query(`
      CREATE TABLE customers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone VARCHAR(20) NOT NULL UNIQUE,
        pin_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        id_number VARCHAR(20),
        kyc_tier kyc_tier NOT NULL DEFAULT 'TIER_0',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_customers_phone ON customers(phone)`);

    // ── Wallets ──
    await queryRunner.query(`
      CREATE TABLE wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        owner_id UUID NOT NULL,
        owner_type wallet_owner_type NOT NULL,
        available BIGINT NOT NULL DEFAULT 0,
        reserved BIGINT NOT NULL DEFAULT 0,
        staked BIGINT NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
        status wallet_status NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_available_non_negative CHECK (available >= 0),
        CONSTRAINT chk_reserved_non_negative CHECK (reserved >= 0),
        CONSTRAINT chk_staked_non_negative CHECK (staked >= 0)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_wallets_owner ON wallets(owner_id, owner_type)`);
    await queryRunner.query(`CREATE INDEX idx_wallets_status ON wallets(status)`);

    // ── Ledger Entries ──
    await queryRunner.query(`
      CREATE TABLE ledger_entries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        type ledger_entry_type NOT NULL,
        amount BIGINT NOT NULL,
        balance_after BIGINT NOT NULL,
        reference_type VARCHAR(50),
        reference_id UUID,
        description VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_ledger_wallet ON ledger_entries(wallet_id)`);
    await queryRunner.query(`CREATE INDEX idx_ledger_created ON ledger_entries(created_at)`);
    await queryRunner.query(`CREATE INDEX idx_ledger_ref ON ledger_entries(reference_type, reference_id)`);

    // ── Transactions ──
    await queryRunner.query(`
      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type transaction_type NOT NULL,
        status transaction_status NOT NULL DEFAULT 'CREATED',
        merchant_id UUID REFERENCES merchants(id),
        customer_id UUID REFERENCES customers(id),
        amount BIGINT NOT NULL,
        fee BIGINT NOT NULL DEFAULT 0,
        reserve_amount BIGINT NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
        qr_payload TEXT,
        auth_code VARCHAR(50),
        risk_level fraud_risk_level,
        risk_score INT,
        customer_ref VARCHAR(100),
        merchant_ref VARCHAR(100),
        on_chain_batch_id VARCHAR(66),
        on_chain_tx_hash VARCHAR(66),
        settled_on_chain_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_txn_merchant ON transactions(merchant_id)`);
    await queryRunner.query(`CREATE INDEX idx_txn_customer ON transactions(customer_id)`);
    await queryRunner.query(`CREATE INDEX idx_txn_status ON transactions(status)`);
    await queryRunner.query(`CREATE INDEX idx_txn_type ON transactions(type)`);
    await queryRunner.query(`CREATE INDEX idx_txn_created ON transactions(created_at)`);
    await queryRunner.query(`CREATE INDEX idx_txn_batch ON transactions(on_chain_batch_id)`);
    await queryRunner.query(`
      CREATE INDEX idx_txn_unsettled
      ON transactions(status)
      WHERE on_chain_batch_id IS NULL AND status = 'COMPLETED'
    `);

    // ── Transaction Events ──
    await queryRunner.query(`
      CREATE TABLE transaction_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id UUID NOT NULL REFERENCES transactions(id),
        event VARCHAR(50) NOT NULL,
        data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_txn_events_txn ON transaction_events(transaction_id)`);

    // ── Advances ──
    await queryRunner.query(`
      CREATE TABLE advances (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        transaction_id UUID NOT NULL REFERENCES transactions(id),
        original_amount BIGINT NOT NULL,
        advance_amount BIGINT NOT NULL,
        advance_fee BIGINT NOT NULL,
        status advance_status NOT NULL DEFAULT 'OUTSTANDING',
        settled_amount BIGINT,
        settled_at TIMESTAMPTZ,
        overdue_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_advances_merchant ON advances(merchant_id)`);
    await queryRunner.query(`CREATE INDEX idx_advances_status ON advances(status)`);
    await queryRunner.query(`CREATE INDEX idx_advances_txn ON advances(transaction_id)`);

    // ── Refills ──
    await queryRunner.query(`
      CREATE TABLE refills (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        amount BIGINT NOT NULL,
        status refill_status NOT NULL DEFAULT 'INITIATED',
        payment_id VARCHAR(255),
        payment_url VARCHAR(500),
        stitch_ref VARCHAR(255),
        retry_count INT NOT NULL DEFAULT 0,
        error_message VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_refills_wallet ON refills(wallet_id)`);
    await queryRunner.query(`CREATE INDEX idx_refills_status ON refills(status)`);
    await queryRunner.query(`CREATE INDEX idx_refills_payment ON refills(payment_id)`);

    // ── Cash-Ins ──
    await queryRunner.query(`
      CREATE TABLE cash_ins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        customer_phone VARCHAR(20) NOT NULL,
        customer_id UUID REFERENCES customers(id),
        amount BIGINT NOT NULL,
        customer_fee BIGINT NOT NULL DEFAULT 0,
        merchant_commission BIGINT NOT NULL DEFAULT 0,
        protocol_fee BIGINT NOT NULL DEFAULT 0,
        status cash_in_status NOT NULL DEFAULT 'INITIATED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_cashin_merchant ON cash_ins(merchant_id)`);
    await queryRunner.query(`CREATE INDEX idx_cashin_phone ON cash_ins(customer_phone)`);
    await queryRunner.query(`CREATE INDEX idx_cashin_status ON cash_ins(status)`);
    await queryRunner.query(`CREATE INDEX idx_cashin_created ON cash_ins(created_at)`);

    // ── Remittances ──
    await queryRunner.query(`
      CREATE TABLE remittances (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tracking_code VARCHAR(20) NOT NULL UNIQUE,
        sender_phone VARCHAR(20) NOT NULL,
        sender_id UUID REFERENCES customers(id),
        recipient_phone VARCHAR(20) NOT NULL,
        recipient_id UUID REFERENCES customers(id),
        send_merchant_id UUID REFERENCES merchants(id),
        collect_merchant_id UUID REFERENCES merchants(id),
        amount BIGINT NOT NULL,
        sender_fee BIGINT NOT NULL DEFAULT 0,
        send_merchant_commission BIGINT NOT NULL DEFAULT 0,
        collect_merchant_commission BIGINT NOT NULL DEFAULT 0,
        protocol_fee BIGINT NOT NULL DEFAULT 0,
        status remittance_status NOT NULL DEFAULT 'ESCROWED',
        expires_at TIMESTAMPTZ,
        collected_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_remit_code ON remittances(tracking_code)`);
    await queryRunner.query(`CREATE INDEX idx_remit_sender ON remittances(sender_phone)`);
    await queryRunner.query(`CREATE INDEX idx_remit_recipient ON remittances(recipient_phone)`);
    await queryRunner.query(`CREATE INDEX idx_remit_status ON remittances(status)`);
    await queryRunner.query(`CREATE INDEX idx_remit_created ON remittances(created_at)`);

    // ── Fraud Alerts ──
    await queryRunner.query(`
      CREATE TABLE fraud_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id UUID REFERENCES transactions(id),
        merchant_id UUID REFERENCES merchants(id),
        customer_id UUID REFERENCES customers(id),
        risk_level fraud_risk_level NOT NULL,
        risk_score INT NOT NULL,
        reason VARCHAR(500) NOT NULL,
        details JSONB DEFAULT '{}',
        resolved BOOLEAN NOT NULL DEFAULT FALSE,
        resolved_by VARCHAR(255),
        resolved_at TIMESTAMPTZ,
        resolution_note VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_fraud_resolved ON fraud_alerts(resolved)`);
    await queryRunner.query(`CREATE INDEX idx_fraud_level ON fraud_alerts(risk_level)`);
    await queryRunner.query(`CREATE INDEX idx_fraud_created ON fraud_alerts(created_at)`);

    // ── KYC Reviews ──
    await queryRunner.query(`
      CREATE TABLE kyc_reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID NOT NULL REFERENCES customers(id),
        requested_tier kyc_tier NOT NULL,
        id_number VARCHAR(20),
        id_photo_url VARCHAR(500),
        selfie_url VARCHAR(500),
        status kyc_review_status NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMPTZ,
        rejection_reason VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_kyc_customer ON kyc_reviews(customer_id)`);
    await queryRunner.query(`CREATE INDEX idx_kyc_status ON kyc_reviews(status)`);

    // ── Settlement Batches (on-chain record) ──
    await queryRunner.query(`
      CREATE TABLE settlement_batches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        batch_nonce INT NOT NULL,
        transaction_count INT NOT NULL,
        total_volume_zar_cents BIGINT NOT NULL,
        total_volume_tokens VARCHAR(78),
        burn_amount_tokens VARCHAR(78),
        treasury_amount_tokens VARCHAR(78),
        pduka_zar_rate VARCHAR(78),
        on_chain_tx_hash VARCHAR(66) NOT NULL,
        block_number BIGINT,
        settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_batch_nonce ON settlement_batches(batch_nonce)`);
    await queryRunner.query(`CREATE INDEX idx_batch_hash ON settlement_batches(on_chain_tx_hash)`);

    // ── Audit Log ──
    await queryRunner.query(`
      CREATE TABLE audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        actor_type VARCHAR(20) NOT NULL,
        actor_id UUID,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_actor ON audit_log(actor_type, actor_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_created ON audit_log(created_at)`);

    // ── Admin Users ──
    await queryRunner.query(`
      CREATE TABLE admin_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Updated_at trigger function ──
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;

      $$ LANGUAGE plpgsql;
    `);

    // Apply trigger to all tables with updated_at
    const tablesWithUpdatedAt = [
      'merchants', 'customers', 'wallets', 'transactions',
      'advances', 'refills', 'cash_ins', 'remittances',
      'kyc_reviews', 'admin_users',
    ];
    for (const table of tablesWithUpdatedAt) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    const tables = [
      'audit_log', 'settlement_batches', 'kyc_reviews',
      'fraud_alerts', 'remittances', 'cash_ins', 'refills',
      'advances', 'transaction_events', 'transactions',
      'ledger_entries', 'wallets', 'customers', 'merchants',
      'admin_users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // Drop trigger function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column`);

    // Drop enums
    const enums = [
      'wallet_owner_type', 'wallet_status', 'transaction_type',
      'transaction_status', 'ledger_entry_type', 'advance_status',
      'refill_status', 'cash_in_status', 'remittance_status',
      'kyc_tier', 'kyc_review_status', 'merchant_status',
      'fraud_risk_level',
    ];
    for (const e of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS ${e}`);
    }
  }
}