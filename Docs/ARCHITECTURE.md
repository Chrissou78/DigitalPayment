# PayDuka — System Architecture Specification

Version: 1.0
Last Updated: 2026-06-05
Status: APPROVED FOR DEVELOPMENT

---

## 1. Architectural Principles

### 1.1 Core Principles

1. **Payments never fail silently.** Every payment operation either succeeds atomically
   or fails explicitly with a clear error state. No partial updates. No orphaned records.

2. **The ledger is the source of truth.** Wallet balances are always derived from the
   append-only ledger. There is no mutable "balance" column. The current balance is the
   sum of all ledger entries for that wallet. This makes the system inherently auditable
   and eliminates an entire class of balance corruption bugs.

3. **Event-sourced transactions.** Transaction records are never updated in place. Every
   state change creates a new TransactionEvent record. The current state of a transaction
   is determined by its most recent event. This provides a complete audit trail and
   enables replaying transaction history for debugging or reconciliation.

4. **Payment rails are pluggable.** The system communicates with payment providers
   (Stitch, M-Pesa, card processors) through an abstraction layer. Swapping or adding
   a payment provider requires implementing an interface, not modifying business logic.

5. **Blockchain is decoupled from payments.** The Polygon blockchain layer (Phase 3)
   records settlement proofs asynchronously. If the blockchain is unavailable, payments
   continue uninterrupted. On-chain recording is an enhancement, not a dependency.

6. **Fail open for reads, fail closed for writes.** If a cache is unavailable, the system
   falls back to the database for reads (slower but correct). If any component required
   for a financial write is unavailable, the operation is rejected rather than proceeding
   in a degraded state.

### 1.2 Non-Negotiable Constraints

- All monetary arithmetic uses integer cents. No floating point. Ever.
- All database operations that modify balances use explicit row-level locks and
  single-transaction atomicity.
- All external payment rail calls are idempotent (using external reference IDs).
- All webhook handlers are idempotent (processing the same webhook twice produces
  the same result).
- All PII is encrypted at rest with AES-256 via AWS KMS.
- No raw card data ever touches PayDuka's systems. Card data is handled exclusively
  by the card acquiring partner (Stitch/PCI-compliant processor).

---

## 2. System Topology

### 2.1 High-Level Architecture

┌─────────────────────────────────────────────────────────────────┐ │ CLIENT LAYER │ │ │ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │ │ │ Customer App │ │ Merchant PoS │ │ Admin Dashboard │ │ │ │ React Native │ │ React Native │ │ Next.js │ │ │ └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘ │ └─────────┼─────────────────┼─────────────────────┼───────────────┘ │ │ │ │ HTTPS/WSS │ │ ▼ ▼ ▼ ┌─────────────────────────────────────────────────────────────────┐ │ API GATEWAY (AWS ALB) │ │ Rate Limiting · TLS Termination · WAF │ └─────────────────────────┬───────────────────────────────────────┘ │ ▼ ┌─────────────────────────────────────────────────────────────────┐ │ NESTJS APPLICATION │ │ (ECS Fargate Cluster) │ │ │ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │ │ │ Auth │ │ Merchant │ │Transaction │ │ Wallet │ │ │ │ Module │ │ Module │ │ Module │ │ Module │ │ │ └────────────┘ └────────────┘ └────────────┘ └──────────────┘ │ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │ │ │ Refill │ │ Payment │ │ Advance │ │ Fraud │ │ │ │ Module │ │ Rail Module│ │ Module │ │ Module │ │ │ └────────────┘ └────────────┘ └────────────┘ └──────────────┘ │ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ │ │ │ Settlement │ │ Webhook │ │ Admin │ │ │ │ Module │ │ Module │ │ Module │ │ │ └────────────┘ └────────────┘ └────────────┘ │ └───────┬──────────────┬──────────────┬───────────────────────────┘ │ │ │ ▼ ▼ ▼ ┌──────────────┐ ┌──────────┐ ┌──────────────┐ │ PostgreSQL │ │ Redis │ │ BullMQ │ │ (RDS) │ │(Elasti- │ │ (Workers) │ │ │ │ Cache) │ │ │ │ - Ledger │ │ - Cache │ │ - Refill │ │ - Merchants │ │ - Session│ │ - Settlement │ │ - Txns │ │ - Rate │ │ - Webhooks │ │ - Audit │ │ Limit │ │ - Notify │ └──────────────┘ └──────────┘ └──────┬───────┘ │ ▼ ┌────────────────────────────┐ │ EXTERNAL SERVICES │ │ │ │ ┌─────────────────────┐ │ │ │ Stitch API │ │ │ │ - PayShap Request │ │ │ │ - Capitec Pay │ │ │ │ - DebiCheck │ │ │ │ - Card Acquiring │ │ │ │ - Account Linking │ │ │ └─────────────────────┘ │ │ ┌─────────────────────┐ │ │ │ AWS KMS │ │ │ │ (Key Management) │ │ │ └─────────────────────┘ │ │ ┌─────────────────────┐ │ │ │ AWS S3 │ │ │ │ (KYC Documents) │ │ │ └─────────────────────┘ │ │ ┌─────────────────────┐ │ │ │ Sentry │ │ │ │ (Error Tracking) │ │ │ └─────────────────────┘ │ └────────────────────────────┘


### 2.2 Module Dependency Map

Arrows indicate "depends on" relationships. Modules may only depend on modules
they have an explicit arrow to. No circular dependencies are permitted.

AuthModule ◄─── MerchantModule ▲ │ │ ▼ │ WalletModule ◄──── RefillModule │ ▲ │ │ ├──── TransactionModule ───► PaymentRailModule │ │ │ │ │ └─────► AdvanceModule │ │ │ └──► FraudModule │ ├──── SettlementModule ───► WalletModule │ ├──── WebhookModule ──────► TransactionModule │ PaymentRailModule │ └──── AdminModule ────────► (read access to all modules)


### 2.3 Module Responsibilities

#### AuthModule
- User registration (customer and merchant)
- Phone number verification via OTP
- JWT access token issuance (15min expiry) and refresh token management (7 day expiry)
- MFA enforcement (SMS OTP for merchants, biometric token for mobile apps)
- Session management and device tracking
- Password hashing (bcrypt, cost factor 12)
- Rate limiting on auth endpoints (5 attempts per 15 minutes)

#### MerchantModule
- Merchant account creation and profile management
- KYC document upload to S3 and verification workflow
- Merchant risk tier management (NEW → STANDARD → TRUSTED)
- Fee tier assignment based on volume and risk
- QR code generation (merchant ID + metadata encoded)
- Merchant search and listing for admin

#### WalletModule
- Wallet creation (one per customer, one per merchant)
- Append-only ledger management
- Balance calculation (sum of all ledger entries)
- Balance types: AVAILABLE, PENDING, RESERVED
- Atomic credit and debit operations with row-level locking
- Wallet freeze/unfreeze for fraud cases
- Auto-refill threshold and amount configuration
- Balance history and statements

#### TransactionModule
- Transaction creation and state machine management
- Event sourcing — all state transitions recorded as immutable events
- Transaction types: WALLET_PAYMENT, BANK_PAYMENT, CARD_PAYMENT, P2P_TRANSFER,
  WALLET_REFILL, MERCHANT_WITHDRAWAL, ADVANCE_CREDIT, ADVANCE_RECOVERY
- QR code payload generation and validation
- Transaction search, filtering, and reporting
- Expiry handling (unpaid transactions expire after 5 minutes)

#### RefillModule
- Proactive refill scheduler (runs every 4 hours, checks all wallets below threshold)
- Reactive refill trigger (fires after any payment drops wallet below threshold)
- Refill execution via PayShap or DebiCheck through PaymentRailModule
- Refill failure handling and retry logic
- Concurrency control (Redis lock — one refill per wallet at a time)
- Insufficient bank funds notification
- Refill history tracking

#### PaymentRailModule
- Abstract PaymentRailProvider interface
- StitchProvider implementation (PayShap Request, Capitec Pay, DebiCheck, Card)
- Payment initiation and status polling
- Webhook registration and signature verification
- Idempotency key management for all external calls
- Circuit breaker pattern for external service failures
- Rail-specific error mapping to internal error codes

#### AdvanceModule
- Merchant eligibility assessment (30+ days history, <0.5% chargeback rate,
  KYC verified, daily cap not exceeded)
- Advance amount calculation (net settlement minus advance fee)
- Advance crediting to merchant wallet
- Outstanding advance tracking
- Settlement reconciliation (match incoming card settlements to outstanding advances)
- Advance fee revenue calculation and recording
- Risk exposure monitoring (total outstanding advances vs. liquidity pool)

#### FraudModule
- Rule-based risk scoring engine
- Per-transaction risk assessment returning LOW / MEDIUM / HIGH
- Rule categories: velocity, amount, device, geolocation, behavior
- Configurable rule thresholds (adjustable without code deployment)
- Fraud alert generation for MEDIUM and HIGH scores
- Manual review queue for HIGH-risk transactions
- Merchant risk tier adjustment recommendations
- Blocked device/IP list management

#### SettlementModule
- Merchant withdrawal processing (wallet → bank account)
- Auto-settlement configuration (threshold-based automatic withdrawal)
- Settlement batch management
- Merchant rolling reserve calculation and release
- Settlement reconciliation against bank confirmations
- Settlement reporting and export

#### WebhookModule
- Dedicated endpoints for each payment provider's webhooks
- Webhook signature verification
- Idempotent processing (duplicate webhook detection via event ID)
- Raw payload logging before processing
- Durable queue write before acknowledgement (BullMQ)
- Asynchronous processing by dedicated workers
- Dead letter queue for failed webhook processing
- Retry configuration per provider

#### AdminModule
- Role-based access control (VIEWER, OPERATOR, RISK_ANALYST, ADMINISTRATOR)
- Real-time transaction dashboard (WebSocket-powered)
- Merchant management interface
- KYC verification workflow
- Fraud alert review and action queue
- Financial reporting (daily, weekly, monthly)
- Reconciliation reports
- System health dashboard
- Audit log viewer

---

## 3. Data Flow Patterns

### 3.1 Wallet-to-Wallet Payment (Primary Flow)

This is the most common transaction type and the lowest-cost path.

Customer App API Database │ │ │ │ POST /transactions │ │ │ {merchantId, amount, │ │ │ qrPayload, authToken} │ │──────────────────────►│ │ │ │ │ │ │ 1. Validate QR payload│ │ │ 2. Verify customer auth│ │ │ 3. Check customer │ │ │ wallet balance │ │ │────────────────────────►│ │ │◄────────────────────────│ │ │ │ │ │ 4. Run fraud scoring │ │ │ (FraudModule) │ │ │ │ │ │ 5. BEGIN TRANSACTION │ │ │ 6. Lock customer wallet│ │ │ 7. Lock merchant wallet│ │ │ 8. Debit customer │ │ │ ledger entry │ │ │ 9. Credit merchant │ │ │ ledger entry │ │ │ (AVAILABLE - fee) │ │ │ 10. Credit merchant │ │ │ reserve entry │ │ │ (RESERVED, 5%) │ │ │ 11. Credit PayDuka fee │ │ │ revenue ledger │ │ │ 12. Create transaction │ │ │ record │ │ │ 13. Create txn events │ │ │ (CREATED, COMPLETED)│ │ │ 14. Create audit log │ │ │ 15. COMMIT TRANSACTION │ │ │────────────────────────►│ │ │◄────────────────────────│ │ │ │ │ Response: SUCCESS │ │ │ {txnId, amount, fee, │ │ │ newBalance} │ │ │◄──────────────────────│ │ │ │ │ │ │ 16. Emit txn.completed │ │ │ event (async) │ │ │ │ │ │ 17. Push notification │ │ │ to merchant PoS │ │ │ via WebSocket │ │ │ │ │ │ 18. Check if customer │ │ │ balance < threshold │ │ │ → Queue refill job │


**Critical implementation notes:**

- Steps 5-15 MUST execute in a single database transaction. If any step fails,
  the entire transaction rolls back. The customer is never debited without the
  merchant being credited.
- Row-level locks (SELECT ... FOR UPDATE) on both wallets prevent concurrent
  payments from creating race conditions.
- The merchant receives (amount - fee - reserve) in AVAILABLE balance, and
  (reserve amount) in RESERVED balance.
- The fee is recorded as a credit to PayDuka's internal revenue wallet.
- The fraud check (step 4) happens BEFORE the database transaction. If risk
  is HIGH, the transaction is rejected before any balance changes occur.

### 3.2 Auto-Refill Flow

Refill Trigger RefillModule PaymentRailModule Stitch (reactive or │ │ │ proactive) │ │ │ │ │ │ │ │ Queue refill job │ │ │ │──────────────────────────►│ │ │ │ │ │ │ │ 1. Acquire Redis lock │ │ │ (wallet:{id}:refill) │ │ │ TTL: 5 minutes │ │ │ │ │ │ │ 2. Check wallet balance │ │ │ < threshold │ │ │ │ │ │ │ 3. Check no in-flight │ │ │ refill exists │ │ │ │ │ │ │ 4. Create refill │ │ │ transaction record │ │ │ (status: INITIATED) │ │ │ │ │ │ │ 5. Initiate payment pull │ │ │ │───────────────────────►│ │ │ │ │ PayShap Request │ │ │ │─────────────────►│ │ │ │◄─────────────────│ │ │ │ {paymentId, url}│ │ │◄───────────────────────│ │ │ │ │ │ │ 6. Update refill txn │ │ │ (status: PENDING_PAYMENT) │ │ │ │ │ │ │ 7. Release Redis lock │ │ │ │ │ │ │ │ │ │ │ ... Stitch confirms payment via webhook ... │ │ │ │ │ │ 8. WebhookModule receives │ │ │ payment confirmation │ │ │ │ │ │ │ 9. Credit customer wallet │ │ │ (AVAILABLE, refill amount) │ │ │ │ │ │ │ 10. Update refill txn │ │ │ (status: COMPLETED) │ │ │ │ │ │ │ 11. Send notification: │ │ │ "Wallet refilled R1,000" │ │


### 3.3 Card Payment with Same-Day Advance

Merchant PoS API FraudModule AdvanceModule Stitch Card │ │ │ │ │ │ POST /txns │ │ │ │ │ {type: CARD, │ │ │ │ │ amount, token}│ │ │ │ │───────────────►│ │ │ │ │ │ │ │ │ │ │ 1. Card auth │ │ │ │ │───────────────────────────────────────────────────►│ │ │◄──────────────────────────────────────────────────│ │ │ {authorized, │ │ │ │ │ authCode} │ │ │ │ │ │ │ │ │ │ 2. Fraud check │ │ │ │ │───────────────────►│ │ │ │ │◄──────────────────│ │ │ │ │ {riskLevel: LOW} │ │ │ │ │ │ │ │ │ │ 3. Create txn │ │ │ │ │ (AUTHORIZED) │ │ │ │ │ │ │ │ │ "Authorized" │ │ │ │ │◄───────────────│ │ │ │ │ │ │ │ │ │ │ 4. Check merchant │ │ │ │ │ advance eligibility │ │ │ │─────────────────────────────────►│ │ │ │◄────────────────────────────────│ │ │ │ {eligible: true, │ │ │ │ │ advanceAmount, │ │ │ │ │ advanceFee} │ │ │ │ │ │ │ │ │ "Advance │ │ │ │ │ available: │ │ │ │ │ R960 for │ │ │ │ │ R14.40 fee" │ │ │ │ │◄───────────────│ │ │ │ │ │ │ │ │ │ POST /txns/ │ │ │ │ │ {id}/advance │ │ │ │ │───────────────►│ │ │ │ │ │ │ │ │ │ │ 5. BEGIN TRANSACTION │ │ │ │ 6. Credit merchant wallet │ │ │ │ (advanceAmount) │ │ │ │ 7. Create advance record │ │ │ │ (OUTSTANDING) │ │ │ │ 8. Debit advance pool │ │ │ │ 9. Record advance fee revenue │ │ │ │ 10. COMMIT │ │ │ │ │ │ │ │ "Advanced │ │ │ │ │ R960.00" │ │ │ │ │◄───────────────│ │ │ │ │ │ │ │ │ │ ... 1-3 days later, card settlement arrives ... │ │ │ │ │ │ │ │ 11. Settlement │ │ │ │ │ webhook │ │ │ │ │◄──────────────────────────────────────────────────│ │ │ │ │ │ │ │ 12. Match to │ │ │ │ │ outstanding advance │ │ │ │ 13. Credit advance pool │ │ │ │ (recovered) │ │ │ │ │ 14. Mark advance │ │ │ │ │ SETTLED │ │ │


---

## 4. Scalability Design

### 4.1 Phase 1-2 (Up to 2,000 merchants, 50,000 txns/month)

Single NestJS instance on ECS Fargate (2 vCPU, 4GB RAM). Single PostgreSQL
RDS instance (db.r6g.large). Single Redis ElastiCache node. BullMQ workers
running in the same ECS service. This architecture comfortably handles
100+ transactions per minute.

### 4.2 Phase 3-4 (Up to 8,000 merchants, 500,000 txns/month)

Horizontally scale NestJS to 2-4 ECS tasks behind ALB. Add PostgreSQL read
replica for analytics and admin dashboard queries. Separate BullMQ workers
into their own ECS service for independent scaling. Add Redis cluster mode.

### 4.3 Phase 5+ (20,000+ merchants, 2M+ txns/month)

Decompose into microservices: TransactionService, WalletService, and
PaymentRailService become independent deployments communicating via message
queue (SQS or NATS). Database sharding by merchant region if needed.
Kubernetes (EKS) replaces ECS for orchestration complexity.

---

## 5. Error Handling Strategy

### 5.1 Error Classification

| Category | HTTP Code | Retry | Alert | Example |
|----------|-----------|-------|-------|---------|
| Client Error | 400/422 | No | No | Invalid amount, missing field |
| Auth Error | 401/403 | No | If >10/min | Invalid token, insufficient role |
| Business Rule | 409 | No | No | Insufficient balance, merchant suspended |
| Rate Limit | 429 | Yes (backoff) | If sustained | Too many requests |
| Provider Error | 502 | Yes (3x) | Yes | Stitch API timeout |
| System Error | 500 | No | Yes | Unhandled exception, DB connection |

### 5.2 Payment Rail Failure Handling

All payment rail calls use a circuit breaker pattern:
- **Closed** (normal): requests flow through to the provider.
- **Open** (failure): after 5 consecutive failures or >50% failure rate in
  60 seconds, the circuit opens. All requests fail immediately without
  calling the provider. After 30 seconds, the circuit moves to half-open.
- **Half-Open** (testing): one request is allowed through. If it succeeds,
  the circuit closes. If it fails, the circuit re-opens.

When the primary rail (PayShap) circuit is open, the system falls back to
alternative rails (Capitec Pay, EFT) where possible.