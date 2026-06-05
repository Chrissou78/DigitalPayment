# PayDuka — Sprint Plan (MoSCoW Prioritization)

Phase 1 MVP: 12 weeks of development (Sprints 1-6, 2-week sprints)

---

## MUST HAVE (MVP launch blocked without these)

### Sprint 1 (Weeks 1-2): Foundation

- [ ] Project scaffolding: NestJS monorepo, TypeScript config, ESLint,
      Prettier, Husky pre-commit hooks
- [ ] Docker Compose for local dev (PostgreSQL 16, Redis 7)
- [ ] Database schema: users, merchants, wallets, wallet_ledger,
      transactions, transaction_events, audit_logs tables
- [ ] TypeORM entity definitions for all core tables
- [ ] Database migration system (TypeORM migrations)
- [ ] Seed script for development data
- [ ] AuthModule: user registration, phone OTP verification, JWT
      issuance, refresh token rotation
- [ ] Basic request validation middleware (ValidationPipe)
- [ ] Error handling: global exception filter with standardized
      error response envelope
- [ ] Health check endpoint
- [ ] Logger setup (structured JSON, correlation IDs)
- [ ] CI pipeline: lint + type check + unit tests on PR

### Sprint 2 (Weeks 3-4): Merchant & Wallet Core

- [ ] MerchantModule: merchant onboarding endpoint, profile CRUD,
      QR code ID generation
- [ ] KYC document upload to S3 (pre-signed URLs)
- [ ] WalletModule: wallet creation (auto-created on user registration),
      balance calculation from ledger, balance query endpoint
- [ ] Wallet ledger: atomic credit/debit operations with row-level
      locking (SELECT ... FOR UPDATE within transaction)
- [ ] System wallets: FEE_REVENUE, ADVANCE_POOL, RESERVE_POOL creation
      in seed/migration
- [ ] Merchant reserve logic: auto-calculate and hold reserve on
      each transaction
- [ ] Unit tests for wallet ledger operations (critical path —
      100% coverage required)

### Sprint 3 (Weeks 5-6): Payment Flows

- [ ] PaymentRailModule: abstract PaymentRailProvider interface
- [ ] StitchProvider: OAuth2 client credential authentication,
      GraphQL client setup
- [ ] StitchProvider: payment initiation (PayShap Request, Pay by Bank)
- [ ] StitchProvider: payment status query
- [ ] WebhookModule: Stitch webhook endpoint, signature verification,
      BullMQ queue write, async processing worker
- [ ] TransactionModule: wallet-to-wallet payment flow
      (full state machine: CREATED → COMPLETED, single DB transaction)
- [ ] TransactionModule: bank payment flow
      (CREATED → PENDING_PAYMENT → COMPLETED via webhook)
- [ ] QR code payload generation and validation
- [ ] Transaction expiry job (expire PENDING transactions after 5 min)
- [ ] WebSocket gateway for real-time merchant PoS notifications
- [ ] Integration tests with Stitch sandbox

### Sprint 4 (Weeks 7-8): Auto-Refill & Card Payments

- [ ] RefillModule: reactive trigger (post-payment balance check →
      queue refill job)
- [ ] RefillModule: proactive trigger (scheduled job every 4 hours,
      scan wallets below threshold)
- [ ] RefillModule: refill execution via PayShap
- [ ] RefillModule: Redis concurrency lock (one refill per wallet)
- [ ] RefillModule: failure handling and retry logic
- [ ] DebiCheck mandate setup flow via Stitch
- [ ] StitchProvider: card payment authorization
- [ ] AdvanceModule: merchant eligibility check
- [ ] AdvanceModule: advance calculation and wallet credit
- [ ] AdvanceModule: settlement reconciliation worker
      (match incoming card settlements to outstanding advances)
- [ ] Card payment end-to-end flow with advance option

### Sprint 5 (Weeks 9-10): Fraud, Admin & Mobile Apps

- [ ] FraudModule: rule engine with configurable rules from database
- [ ] FraudModule: implement all Phase 1 rules (V1-V4, A1-A3, D1-D3)
- [ ] FraudModule: risk scoring middleware on all transaction endpoints
- [ ] fraud_assessments recording for every transaction
- [ ] Admin Dashboard: Next.js project setup, authentication, RBAC
- [ ] Admin Dashboard: real-time transaction monitoring page
- [ ] Admin Dashboard: merchant management page (list, detail, verify)
- [ ] Admin Dashboard: fraud alert review queue
- [ ] Admin Dashboard: basic financial summary
- [ ] Merchant PoS App: React Native project setup (Android)
- [ ] Merchant PoS App: login, transaction entry, QR code display,
      payment confirmation (WebSocket), balance view
- [ ] Customer App: React Native project setup (Android)
- [ ] Customer App: registration, bank linking, auto-refill setup,
      QR scanning, payment confirmation, balance view

### Sprint 6 (Weeks 11-12): Integration, Testing & Hardening

- [ ] SettlementModule: merchant withdrawal to bank via Stitch payout
- [ ] Merchant auto-settlement configuration and execution
- [ ] Reserve release job (release reserves past their hold period)
- [ ] Reconciliation service: hourly ledger vs. bank balance check
- [ ] End-to-end testing: complete wallet payment flow
- [ ] End-to-end testing: complete bank payment flow
- [ ] End-to-end testing: complete card payment + advance flow
- [ ] End-to-end testing: auto-refill trigger and execution
- [ ] Load testing: simulate 100 concurrent transactions
- [ ] Security review: authentication flows, encryption, input validation
- [ ] API documentation generation (Swagger/OpenAPI from NestJS decorators)
- [ ] Production deployment: Terraform for AWS infrastructure,
      ECS task definitions, RDS setup, ElastiCache setup
- [ ] Production deployment: GitHub Actions CD pipeline
- [ ] Monitoring: CloudWatch dashboards, Sentry error tracking,
      critical alert configuration
- [ ] Operational runbooks: payment rail failure, database failover,
      reconciliation mismatch

---

## SHOULD HAVE (Delivered in Sprint 6 or early Phase 2 — important but
not blocking pilot launch)

- [ ] P2P transfers between customer wallets
- [ ] Push notifications (FCM for Android) on payment received,
      refill completed, advance settled
- [ ] Transaction search and filtering in both apps
- [ ] Merchant daily/weekly sales summary email
- [ ] Admin Dashboard: reconciliation report page
- [ ] Admin Dashboard: advance monitoring page
- [ ] Geolocation fraud rules (G1, G2)
- [ ] Behavior fraud rules (B1-B3)
- [ ] Merchant-specific fraud rules (M1-M3)
- [ ] Split payment: wallet + bank when wallet balance insufficient
- [ ] Customer transaction receipt (PDF generation, email/SMS)
- [ ] Merchant settlement history and export (CSV)

---

## COULD HAVE (Phase 2 backlog — valuable but not critical for pilot)

- [ ] iOS versions of both apps
- [ ] Cash agent on-ramp integration
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

## WON'T HAVE (Explicitly deferred to Phase 3+)

- [ ] Blockchain integration (Polygon settlement proofs)
- [ ] PDuka token (ERC-20 deployment, rewards, staking)
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
- **Daily Standup:** 09:00 SAST, 15 minutes, async-friendly (Slack post
  if remote)
- **Sprint Review/Demo:** Friday afternoon of Week 2 (1 hour, stakeholders
  invited)
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

## Velocity Assumptions

- Team: 4 developers + 1 QA (added Sprint 5)
- Velocity: ~40 story points per sprint (2-week sprint)
- Story point scale: 1 (trivial), 2 (small), 3 (medium),
  5 (large), 8 (very large, should be split)
- Buffer: 20% of sprint capacity reserved for bugs and unplanned work

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Stitch API integration takes longer than estimated | HIGH | MEDIUM | Start Sprint 3 with Stitch sandbox early. Allocate 2 devs to integration. Abstract behind interface so mock can be used until live. |
| DebiCheck mandate setup complexity | MEDIUM | HIGH | Begin Stitch DebiCheck research in Sprint 2. Fallback: manual PayShap top-up only for pilot (no auto-refill via DebiCheck). |
| Card acquiring partnership delay | HIGH | MEDIUM | Card payments are Sprint 4. If partnership isn't ready, pilot launches with wallet + bank payments only. Card + advance added post-pilot. |
| React Native development slower than estimated | MEDIUM | MEDIUM | Prioritize merchant app over customer app. Pilot can launch with merchant Android app + customer web fallback if needed. |
| Fraud engine false positives | LOW | HIGH | Launch with conservative thresholds (fewer triggers). Tune based on pilot data. All MEDIUM-risk auto-approve after 24h if not reviewed. |