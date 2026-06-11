# PayDuka — Sprint Plan (MoSCoW Prioritization)

Version: 2.0
Last Updated: 2026-06-06

Phase 1 MVP: 12 weeks of development (Sprints 1-6, 2-week sprints)

> This version is statused against the actual codebase. Legend:
> `[x]` built and covered by tests where applicable, `[~]` present but partial
> or depth unverified, `[ ]` not started. Where the build diverged from the
> original plan, a short note explains the difference.
>
> Schema naming: the plan predates the implemented schema. `users` is split into
> `merchants` and `customers`; `wallet_ledger` is `ledger_entries` (accounting
> `type` plus `reference_type`); `audit_logs` is `audit_log`; fee/reserve money
> is tracked as ledger entries, not a separate `system_wallets` table. See
> `DATABASE.md`.

---

## Current Status Summary (2026-06-06)

- **Backend:** all core modules scaffolded and wired. Unit suite green at 27
  tests across 7 suites (wallet, transaction, staking, fraud, cash-in,
  remittance, advance). Service code follows the `*.service.spec.ts` files.
- **Ledger:** virtual-account model and the accounting split (primitive `type`
  plus business `reference_type`) are implemented and consolidated into
  `@payduka/shared`.
- **Contracts:** all six built and tested on Hardhat 3, 21 Mocha + 21 Solidity
  tests green. This is ahead of the original plan, which deferred blockchain to
  Phase 3 (see Won't Have).
- **Apps:** merchant app, customer app, and admin dashboard are scaffolded with
  their screens and stores.
- **Not yet done:** end-to-end and load testing, production AWS infrastructure,
  monitoring, runbooks, and several external-rail depth items (DebiCheck,
  reconciliation worker). Auth is single-token JWT; OTP, refresh rotation, and
  MFA are still pending.

---

## MUST HAVE (MVP launch blocked without these)

### Sprint 1 (Weeks 1-2): Foundation

- [x] Project scaffolding: NestJS monorepo, TypeScript config (pnpm + Turborepo)
- [~] ESLint, Prettier, Husky pre-commit hooks (lint config present; Husky unverified)
- [x] Docker Compose for local dev (PostgreSQL 16, Redis 7)
- [x] Database schema (implemented as merchants, customers, wallets,
      ledger_entries, transactions, transaction_events, audit_log, plus product
      tables — 15 tables total)
- [x] TypeORM entity definitions for all core tables
- [x] Database migration system (TypeORM migrations: InitialSchema + SeedAdminUser)
- [~] Seed script (admin user is seeded by migration; broader dev seed not present)
- [~] AuthModule: JWT issuance and login implemented. Phone OTP verification and
      refresh-token rotation are NOT yet built (single-token model)
- [x] Request validation (ValidationPipe + class-validator DTOs)
- [x] Error handling: global exception filter with standardized envelope
- [ ] Health check endpoint (not found)
- [~] Logger setup (Nest Logger in use; structured JSON + correlation IDs unverified)
- [x] CI pipeline: lint + build + tests on PR (`.github/workflows/ci.yml`)

### Sprint 2 (Weeks 3-4): Merchant & Wallet Core

- [~] MerchantModule: onboarding, profile, lookup implemented; QR code ID
      generation unverified
- [ ] KYC document upload to S3 (pre-signed URLs) — `kyc_reviews` holds URLs but
      the upload path is not built
- [x] WalletModule: wallet creation (`createForMerchant`) and balance query
      (`getBalance`). Note: balances are stored on the wallet row, with the
      ledger as the audit trail — not recomputed from the ledger on every read
- [x] Wallet ledger: atomic credit/debit with row-level locking (FOR UPDATE)
- [~] System/fee balances: implemented as `FEE_REVENUE` ledger entries rather
      than separate FEE_REVENUE/ADVANCE_POOL/RESERVE_POOL system wallets
- [x] Merchant reserve logic: rolling reserve held via `RESERVE_HOLD` on payment
- [x] Unit tests for wallet ledger operations

### Sprint 3 (Weeks 5-6): Payment Flows

- [x] PaymentRailModule: provider facade (`payment-rail.service.ts`)
- [~] StitchProvider: GraphQL client and auth URL configured; OAuth2 client-
      credentials depth unverified
- [~] StitchProvider: payment initiation (PayShap / Pay by Bank) — client present
- [~] StitchProvider: payment status query — present, depth unverified
- [~] WebhookModule: webhook controller present; BullMQ queue used by refills;
      signature verification depth unverified
- [x] TransactionModule: wallet-to-wallet payment (`createPayment`, atomic; plus
      the fuller `create` flow with fraud, reserve, and fee)
- [~] TransactionModule: bank payment flow (CREATED → PENDING_PAYMENT → COMPLETED)
- [~] QR payload generation and validation
- [ ] Transaction expiry job (expire PENDING after 5 min)
- [x] WebSocket gateway for real-time merchant PoS notifications
- [ ] Integration tests with Stitch sandbox (only unit tests exist today)

### Sprint 4 (Weeks 7-8): Auto-Refill & Card Payments

- [~] RefillModule: reactive trigger and BullMQ processor present
- [~] RefillModule: proactive scheduled scan — present, depth unverified
- [~] RefillModule: refill execution via PayShap
- [~] RefillModule: retry logic (`retry_count` on refills); Redis concurrency
      lock unverified
- [ ] DebiCheck mandate setup flow via Stitch
- [~] StitchProvider: card payment authorization (used by advance path)
- [~] AdvanceModule: merchant eligibility check
- [x] AdvanceModule: advance calculation and wallet credit (with ledger entries)
- [~] AdvanceModule: settlement reconciliation worker
- [~] Card payment end-to-end flow with advance option

### Sprint 5 (Weeks 9-10): Fraud, Admin & Mobile Apps

- [~] FraudModule: rule engine implemented in code (in-memory), not yet
      database-configurable
- [~] FraudModule: amount-based rules implemented; velocity/device/geo rules are
      stubbed TODOs (see `FRAUDENGINE.md`)
- [x] FraudModule: risk scoring invoked in the transaction flow
- [~] Fraud recording: persisted to `fraud_alerts` (not a `fraud_assessments` table)
- [x] Admin Dashboard: Next.js project, layout, auth shell
- [x] Admin Dashboard: transaction monitoring page
- [x] Admin Dashboard: merchant management page
- [x] Admin Dashboard: fraud alert review queue page
- [x] Admin Dashboard: financial summary / overview page (+ KYC, cash-in,
      remittances, advances, settlement, on-chain pages)
- [x] Merchant PoS App: React Native (Expo) project
- [x] Merchant PoS App: login, charge/transaction entry, balance, WebSocket
      confirmation, cash-in and remittance screens
- [x] Customer App: React Native (Expo) project
- [~] Customer App: registration, QR pay, send, activity, profile screens present;
      bank linking and auto-refill setup unverified

### Sprint 6 (Weeks 11-12): Integration, Testing & Hardening

- [~] SettlementModule: settlement service and on-chain bridge present; bank
      payout depth unverified
- [ ] Merchant auto-settlement configuration and execution
- [~] Reserve release job
- [ ] Reconciliation service: hourly ledger vs. bank balance check
- [ ] End-to-end testing (only an e2e scaffold exists: `test/app.e2e-spec.t`)
- [ ] Load testing (100 concurrent transactions)
- [ ] Security review
- [ ] API documentation generation (Swagger/OpenAPI)
- [ ] Production deployment: Terraform for AWS (not committed)
- [x] CD pipeline: `deploy-staging.yml` and `deploy-production.yml` present
      (plus `contract-deploy.yml`)
- [ ] Monitoring: CloudWatch dashboards, Sentry, alerts
- [ ] Operational runbooks

---

## SHOULD HAVE (important but not blocking pilot launch)

- [ ] P2P transfers between customer wallets
- [ ] Push notifications (FCM) on payment received, refill completed, advance settled
- [~] Transaction search and filtering in apps (activity screens present)
- [ ] Merchant daily/weekly sales summary email
- [x] Admin Dashboard: settlement and reconciliation-adjacent pages present
- [x] Admin Dashboard: advance monitoring page
- [ ] Geolocation fraud rules
- [ ] Behavior fraud rules
- [ ] Merchant-specific fraud rules
- [ ] Split payment: wallet + bank when wallet balance insufficient
- [ ] Customer transaction receipt (PDF generation, email/SMS)
- [ ] Merchant settlement history and export (CSV)

---

## COULD HAVE (Phase 2 backlog)

- [~] iOS versions of both apps (Expo supports iOS; not yet targeted/tested)
- [ ] Cash agent on-ramp integration (cash-in module exists; agent on-ramp is broader)
- [ ] Merchant referral programme
- [ ] Customer referral programme
- [ ] Advanced merchant analytics (trends, peak hours, average basket)
- [ ] Customer spending categorization
- [ ] Multi-language support (Zulu, Swahili, Afrikaans)
- [ ] Offline transaction caching on merchant PoS
- [ ] Bluetooth card reader integration
- [ ] Admin Dashboard: system health monitoring page
- [ ] Admin Dashboard: user management for admin accounts
- [ ] Bulk merchant onboarding (CSV upload)
- [ ] API rate limiting per merchant tier

---

## WON'T HAVE → now PARTIALLY BUILT (blockchain pulled forward)

The blockchain layer was originally deferred to Phase 3. It has since been built
and tested ahead of schedule, so these items are no longer "won't have". They
are not yet wired into a live network, but the contracts and the bridge exist.

- [x] Smart contracts: PDukaToken, PDukaPool, PDukaOracle, PDukaTreasury,
      StakingPool, SettlementRegistry (Hardhat 3, 21 Mocha + 21 Solidity tests green)
- [~] Blockchain settlement: `SettlementBridgeService` and `settlement_batches`
      table exist; live batch settlement against a deployed network is pending
- [~] PDuka token + staking: contracts built; in-app `StakingModule` writes
      `STAKE_LOCK`/`STAKE_UNLOCK`/`STAKING_REWARD` ledger entries; on-chain sync pending
- [x] Contract deploy pipeline: `contract-deploy.yml`

Still genuinely deferred (Phase 3+):

- [ ] Play-to-Earn gaming
- [ ] Governance voting
- [ ] Cross-border payments
- [ ] Hardware PoS terminal
- [ ] M-Pesa integration (Kenya)
- [ ] Developer SDK / public API
- [ ] AI-powered fraud detection (ML models)
- [ ] Franchise payroll system

---

## Sprint Ceremonies

- **Sprint Planning:** Monday morning of Week 1 of each sprint (2 hours)
- **Daily Standup:** 09:00 SAST, 15 minutes, async-friendly (Slack post if remote)
- **Sprint Review/Demo:** Friday afternoon of Week 2 (1 hour, stakeholders invited)
- **Sprint Retro:** Friday after review (30 min, team only)

## Definition of Done

A ticket is DONE when:
1. Code is written, follows project conventions, and passes linting
2. Unit tests written and passing (>80% coverage for business logic,
   100% for wallet/ledger operations)
3. Integration tests written for any external service interaction
4. API endpoints documented with Swagger decorators
5. Code reviewed and approved by at least one other developer
6. CI pipeline passing (lint + type check + tests)
7. Deployed to staging and manually smoke-tested
8. No known regressions in existing functionality

> Reality check: items 1, 2, 5, and 6 hold for the current unit-tested modules.
> Integration tests (3), Swagger docs (4), and staging smoke tests (7) are not
> yet in place across the board.

## Velocity Assumptions

- Team: 4 developers + 1 QA (added Sprint 5)
- Velocity: ~40 story points per sprint (2-week sprint)
- Story point scale: 1 (trivial), 2 (small), 3 (medium), 5 (large),
  8 (very large, should be split)
- Buffer: 20% of sprint capacity reserved for bugs and unplanned work

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Stitch API integration takes longer than estimated | HIGH | MEDIUM | Stitch client is abstracted behind a provider facade and mockable; sandbox integration still pending. |
| DebiCheck mandate setup complexity | MEDIUM | HIGH | Not yet started. Fallback: manual PayShap top-up only for pilot. |
| Card acquiring partnership delay | HIGH | MEDIUM | Card + advance paths exist in code; pilot can launch wallet + bank only if the partnership slips. |
| React Native development slower than estimated | MEDIUM | MEDIUM | Both apps scaffolded; prioritize merchant app for pilot. |
| Fraud engine false positives | LOW | HIGH | Launch with conservative amount thresholds; tune on pilot data once velocity/device rules land. |
| No integration / e2e / load tests yet | MEDIUM | HIGH | Unit suite is green; add Stitch sandbox integration and e2e before pilot. |
