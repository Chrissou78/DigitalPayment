# PayDuka — Repository Structure & File Reference

Version: 1.0
Last Updated: 2026-06-06

This document is the map of the repository. It explains how the monorepo is
organised, what each folder is for, and what every significant file does. It is
meant to be read top to bottom the first time, then used as a lookup afterwards.

For the system design behind this layout, see `ARCHITECTURE.md`. For the database
shape, see `DATABASE.md`.

---

## 1. Monorepo at a glance

PayDuka is a pnpm + Turborepo monorepo. Three workspace globs are defined in
`pnpm-workspace.yaml`: `apps/*`, `packages/*`, and `contracts`. Every app and
package has its own `package.json`; the root `package.json` only holds workspace
scripts and Turborepo.

```
DigitalPayment/                 repo root (the product is "PayDuka")
├── apps/                       runnable applications
│   ├── api/                    NestJS backend — the source of truth for all money
│   ├── merchant-app/           React Native (Expo) merchant point-of-sale app
│   ├── customer-app/           React Native (Expo) customer wallet app
│   └── admin-dashboard/        Next.js operations console
├── packages/
│   └── shared/                 enums, interfaces, constants shared across apps
├── contracts/                  Solidity (Hardhat 3) smart contracts + tests
├── infra/                      local/dev infrastructure (docker-compose)
├── Docs/                       all project documentation (this folder)
├── Deck/                       investor/pitch material (pptx + pdf)
├── Website/                    static marketing page + whitepaper
├── .github/workflows/          CI/CD pipelines
├── package.json                workspace scripts + Turborepo
├── turbo.json                  Turborepo task pipeline
├── pnpm-workspace.yaml          workspace globs
└── pnpm-lock.yaml              dependency lockfile
```

A note on naming: the GitHub repository and local folder are `DigitalPayment`,
but the product, the npm scope (`@payduka/*`), and all branding are `PayDuka`.

---

## 2. Root files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace manifest. Holds the `dev:*`, `build:all`, `test:all`, `infra:*`, and `contracts:*` scripts, and the single root dependency, Turborepo. Individual app dependencies live in each app's own `package.json`. |
| `turbo.json` | Turborepo pipeline. Declares task graph: `build` depends on upstream builds, `test` depends on `build`, `dev` is persistent and uncached. |
| `pnpm-workspace.yaml` | Declares the three workspace globs. |
| `pnpm-lock.yaml` | Locked dependency tree for the whole workspace. Commit changes to this whenever dependencies change. |
| `.gitignore` | Ignores `node_modules`, build output (`dist`, `.next`, Expo `.expo`), env files, Hardhat `artifacts`/`cache`/`types`, coverage, and logs. |
| `.dockerignore` | Trims the Docker build context for the API image. |

---

## 3. `apps/api` — NestJS backend

The backend is the heart of the platform and the only component that owns money.
Every balance change happens here inside a database transaction. Blockchain work
is a downstream, batched reflection of what already happened in Postgres.

### 3.1 API root files

| Path | Purpose |
|------|---------|
| `apps/api/package.json` | API dependencies and scripts (`start:dev`, `build`, `test`, `migration:*`). npm scope `@payduka/api`. |
| `apps/api/nest-cli.json` | Nest CLI config (source root, compiler options). |
| `apps/api/tsconfig.json` | TypeScript config for the API. Includes the `@payduka/shared` path mapping so type-checking resolves the shared package from source. |
| `apps/api/tsconfig.build.json` | Build-only TS config that excludes tests. |
| `apps/api/jest.config.ts` | Jest + ts-jest config. Maps `@payduka/shared` to the shared package source for tests. |
| `apps/api/Dockerfile` | Multi-stage build for the production API container. |
| `apps/api/test/jest-e2e.json` | Jest config for end-to-end tests. |
| `apps/api/test/app.e2e-spec.t` | E2E test scaffold (note the truncated extension; intended as `.ts`). |

### 3.2 API bootstrap & configuration (`apps/api/src`)

| Path | Purpose |
|------|---------|
| `main.ts` | Application entry point. Boots the Nest app, sets the global API prefix, validation pipe, exception filter, and CORS. |
| `app.module.ts` | Root module. Wires TypeORM, config, BullMQ, and every feature module together. |
| `data-source.ts` | Standalone TypeORM `DataSource` used by the migration CLI (separate from the runtime Nest config). |
| `config/configuration.ts` | Central typed config factory. Reads env vars for database, Redis, JWT, Stitch, and business rules. Sets `synchronize=false` and `migrationsRun=true` in production. |

### 3.3 Feature modules

Each module follows the Nest convention: a `*.module.ts` wires it, a
`*.controller.ts` exposes HTTP routes, a `*.service.ts` holds business logic,
`dto/` holds request validation classes, and `entities/` holds TypeORM entities.
Modules with `*.service.spec.ts` files have unit tests.

**`auth/` — authentication & authorization**
| File | Purpose |
|------|---------|
| `auth.module.ts` | Wires the auth module, JWT, and Passport strategy. |
| `auth.controller.ts` | Login and token endpoints. |
| `auth.service.ts` | Credential checks, JWT issuance. |
| `dto/login.dto.ts` | Login request validation. |
| `strategies/jwt.strategy.ts` | Passport JWT strategy; validates the bearer token and attaches the user to the request. |

**`merchant/` — merchant accounts**
| File | Purpose |
|------|---------|
| `merchant.module.ts` / `merchant.controller.ts` / `merchant.service.ts` | Merchant onboarding, profile, lookup. The service also creates the merchant's wallet via `WalletService.createForMerchant`. |
| `entities/merchant.entity.ts` | `merchants` table mapping. Holds business profile, API credentials, status, KYC tier, trailing volume, chargeback rate. |
| `dto/create-merchant.dto.ts`, `dto/update-merchant.dto.ts` | Request validation. |

**`wallet/` — balances & the ledger (core money module)**
| File | Purpose |
|------|---------|
| `wallet.module.ts` | Wires the wallet module and its repositories. |
| `wallet.service.ts` | The central money primitives: `debit`, `credit`, `getBalance`, `createForMerchant`, `findByMerchantId`. Locks wallet rows with pessimistic writes and records every movement as a ledger entry. |
| `entities/wallet.entity.ts` | `wallets` table. The virtual-account model: `ownerId` + `ownerType` (MERCHANT or CUSTOMER), and three balances in ZAR cents — `available`, `reserved`, `staked` — plus `currency` and `status`. |
| `entities/ledger-entry.entity.ts` | `ledger_entries` table. Append-only money log. Records the accounting primitive in `type`, the business context in `referenceType`/`referenceId`, the signed `amount`, and the `balanceAfter`. |
| `dto/credit-wallet.dto.ts` | Validation for the admin/credit endpoint. |
| `wallet.service.spec.ts` | Unit tests for balance retrieval and the not-found path. |

**`transaction/` — payments**
| File | Purpose |
|------|---------|
| `transaction.module.ts` / `transaction.controller.ts` | Wiring and HTTP routes for payments. |
| `transaction.service.ts` | Payment orchestration. `createPayment` runs an atomic wallet-to-wallet payment (debit customer, credit merchant net of fee). `create` handles the fuller flow with fraud scoring, reserve hold, and fee revenue. |
| `entities/transaction.entity.ts` | `transactions` table. Immutable payment record with type, status, amounts, risk fields, and on-chain settlement references. |
| `entities/transaction-event.entity.ts` | `transaction_events` table. Append-only state-change log per transaction. |
| `dto/create-transaction.dto.ts` | Payment request validation. |
| `transaction.service.spec.ts` | Unit tests: fee math and insufficient-balance rejection. |

**`cash-in/` — agent cash deposits**
| File | Purpose |
|------|---------|
| `cash-in.service.ts` | Customer deposits cash with a merchant agent; debits the agent float, credits the customer, and pays agent commission. |
| `entities/cash-in.entity.ts` | `cash_ins` table. |
| `dto/create-cash-in.dto.ts`, `dto/confirm-cash-in.dto.ts` | Request validation. |
| `cash-in.service.spec.ts` | Unit tests. |

**`remittance/` — send & collect via tracking code**
| File | Purpose |
|------|---------|
| `remittance.service.ts` | Sender's merchant is debited and escrows funds; collecting merchant is credited on collection. Both merchants earn commission. |
| `entities/remittance.entity.ts` | `remittances` table, including the tracking code and escrow state. |
| `dto/create-remittance.dto.ts`, `dto/collect-remittance.dto.ts` | Request validation. |
| `remittance.service.spec.ts` | Unit tests. |

**`advance/` — same-day card advance**
| File | Purpose |
|------|---------|
| `advance.service.ts` | Credits a merchant the advance amount against a pending card settlement, nets the advance fee, and recovers principal on settlement. |
| `entities/advance.entity.ts` | `advances` table. |
| `dto/request-advance.dto.ts` | Request validation. |
| `advance.service.spec.ts` | Unit tests. |

**`refill/` — auto top-up**
| File | Purpose |
|------|---------|
| `refill.service.ts` | Credits a wallet on a completed top-up and records the ledger entry. |
| `refill.processor.ts` | BullMQ worker that processes queued refill jobs (Stitch pulls via DebiCheck/PayShap). |
| `entities/refill.entity.ts` | `refills` table. |
| `dto/configure-refill.dto.ts` | Refill configuration validation. |

**`staking/` — in-app yield**
| File | Purpose |
|------|---------|
| `staking.service.ts` | Moves balance between `available` and `staked`, distributes daily rewards, and writes `STAKE_LOCK`/`STAKE_UNLOCK`/`STAKING_REWARD` ledger entries. |
| `staking.service.spec.ts` | Unit tests. (Module wiring is folded into the app; there is no separate staking controller.) |

**`fraud/` — risk scoring**
| File | Purpose |
|------|---------|
| `fraud.service.ts` | In-memory rules engine. `score()` returns `{ riskLevel, score, flags, pass }`. Current rules are amount-based; velocity, device, and geo checks are stubbed as TODOs. |
| `fraud.module.ts` | Wiring. |
| `fraud.service.spec.ts` | Unit tests: low-value passes, extreme-value is blocked. |

**`payment-rail/` — external bank/card rails (Stitch)**
| File | Purpose |
|------|---------|
| `payment-rail.service.ts` | Facade over external rails. |
| `stitch/stitch.service.ts` | Stitch GraphQL client (PayShap, Capitec Pay, DebiCheck, card acquiring). Depends on `graphql-request`. |
| `stitch/stitch.types.ts` | Typed Stitch GraphQL payloads. |

**`settlement/` — batch settlement & on-chain bridge**
| File | Purpose |
|------|---------|
| `settlement.service.ts` | Daily off-chain batch settlement and reserve release. |
| `settlement-bridge.service.ts` | On-chain bridge: aggregates completed transactions, calls `PDukaPool.batchSettle`, updates the oracle, handles off-ramp withdrawals. |
| `settlement.module.ts` | Wiring. |

**Supporting modules**
| Path | Purpose |
|------|---------|
| `notification/notification.gateway.ts` | WebSocket gateway pushing real-time events to apps. |
| `notification/notification.service.ts` | Push/WebSocket notification logic. |
| `webhook/webhook.controller.ts` | Inbound provider callbacks (Stitch); verifies signatures. |
| `admin/admin.controller.ts` | Dashboard stats, KYC queue, fraud queue endpoints. |

### 3.4 Cross-cutting code (`apps/api/src/common`)

| Path | Purpose |
|------|---------|
| `decorators/roles.decorator.ts` | `@Roles()` metadata decorator for role-based routes. |
| `guards/jwt-auth.guard.ts` | Rejects requests without a valid JWT. |
| `guards/roles.guard.ts` | Enforces role requirements. |
| `filters/all-exceptions.filter.ts` | Global exception filter that shapes errors into the standard response envelope. |
| `dto/pagination.dto.ts` | Shared pagination query params. |
| `interfaces/request-with-user.interface.ts` | Typed request carrying the authenticated user. |
| `enums/*.enum.ts` | API-local enums (`role`, `transaction-status`, `transaction-type`, `wallet-status`, `advance-status`, `refill-status`). Money-movement enums (ledger types) live in `packages/shared` as the single source of truth. |

### 3.5 Migrations (`apps/api/src/migrations`)

| File | Purpose |
|------|---------|
| `1717600000000-InitialSchema.ts` | Creates all enum types and all 15 tables with indexes and check constraints. This file is the authoritative database schema. See `DATABASE.md`. |
| `1717600000001-SeedAdminUser.ts` | Seeds the initial `admin_users` row from `ADMIN_DEFAULT_EMAIL`/`ADMIN_DEFAULT_PASSWORD`. |

---

## 4. `apps/merchant-app` and `apps/customer-app` — React Native (Expo)

Both apps share the same shape: Expo Router screens under `src/app`, reusable
components under `src/components`, API/WebSocket clients under `src/lib`, and
Zustand stores under `src/stores`. Users only ever see Rands; no wallet keys, no
gas, no tokens.

| Path | Purpose |
|------|---------|
| `app.config.ts` | Expo app configuration. |
| `global.css`, `tailwind.config.js` | NativeWind/Tailwind styling. |
| `tsconfig.json`, `package.json` | App TS config and dependencies. |
| `src/app/_layout.tsx` | Root navigation layout. |
| `src/app/(tabs)/_layout.tsx` | Tab navigator. |
| `src/lib/api.ts` | REST client to the backend. |
| `src/lib/ws.ts` | WebSocket client for real-time events. |
| `src/components/BiometricGate.tsx`, `PinLogin.tsx` | Auth gates. |
| `src/stores/auth.ts`, `wallet.ts`, `transactions.ts` | Zustand state slices. |

**Merchant-app screens** (`src/app/(tabs)`): `index.tsx` (dashboard), `charge.tsx`
(take a payment), `cashin.tsx` (agent cash-in), `remittance.tsx` (send/collect),
`more.tsx`. Plus `components/` and `stores/` as above.

**Customer-app screens** (`src/app/(tabs)`): `index.tsx` (home/balance),
`pay.tsx` (scan & pay), `send.tsx` (remittance), `activity.tsx` (history),
`profile.tsx`. Adds `components/RegisterScreen.tsx` and `stores/remittance.ts`.

---

## 5. `apps/admin-dashboard` — Next.js operations console

| Path | Purpose |
|------|---------|
| `next.config.js`, `postcss.config.js`, `tailwind.config.js`, `tsconfig.json` | Next.js + Tailwind config. |
| `src/app/layout.tsx`, `src/app/page.tsx` | Root layout and landing/login. |
| `src/app/dashboard/layout.tsx` | Authenticated dashboard shell. |
| `src/app/dashboard/page.tsx` | Overview/home. |
| `src/app/dashboard/{merchants,transactions,advances,cash-in,remittances,fraud,kyc,settlement,on-chain,settings}/page.tsx` | One page per operational area. |
| `src/components/{DataTable,Sidebar,StatCard,StatusBadge,VolumeChart}.tsx` | Shared UI components. |
| `src/lib/api.ts`, `src/lib/types.ts` | API client and shared types for the dashboard. |

---

## 6. `packages/shared` — the shared contract between apps

This package is the single source of truth for enums, interfaces, and business
constants used across the backend and frontends. It is consumed as
`@payduka/shared`.

| Path | Purpose |
|------|---------|
| `src/index.ts` | Barrel that re-exports enums, interfaces, and constants. |
| `src/enums/index.ts` | Barrel for all enums. |
| `src/enums/ledger-entry-type.enum.ts` | The accounting primitives recorded in `ledger_entries.type`: `DEBIT`, `CREDIT`, `RESERVE_HOLD`, `RESERVE_RELEASE`, `STAKE_LOCK`, `STAKE_UNLOCK`, `STAKING_REWARD`, `FEE_REVENUE`, `ADVANCE_CREDIT`, `ADVANCE_RECOVERY`. Matches the database enum exactly. |
| `src/enums/ledger-reference-type.enum.ts` | The business context recorded in `ledger_entries.reference_type`: `PAYMENT`, `CASH_IN`, `CASH_OUT`, `REMITTANCE`, `REFILL`, `ADVANCE`, `STAKING`, `COMMISSION`, `FEE`. |
| `src/enums/{transaction-type,transaction-status,wallet-status,advance-status,refill-status,cash-in-status,remittance-status,kyc-tier,role}.enum.ts` | Domain enums shared across the stack. |
| `src/constants/cash-in-fees.constant.ts`, `kyc-limits.constant.ts`, `remittance-fees.constant.ts` | Fee tiers and KYC limits. |
| `src/interfaces/jwt-payload.interface.ts`, `cash-in-fees.interface.ts`, `remittance-fees.interface.ts` | Shared type contracts. |
| `package.json` | Declares the package. Note `main`/`types` point at `dist/`; apps resolve the source directly via tsconfig/jest path mappings, so a build is not required for development or tests. |

---

## 7. `contracts` — Solidity (Hardhat 3)

The on-chain layer. Off-chain Postgres is the source of truth; these contracts
provide deflationary burn, transparent treasury, staking yield, and a verifiable
audit trail.

| Path | Purpose |
|------|---------|
| `hardhat.config.ts` | Hardhat 3 config. Uses the Mocha + ethers toolbox, sources from `src/`, and defines the `amoy` (testnet) and `polygon` (mainnet) networks. |
| `tsconfig.json`, `package.json` | TS config and contract dependencies (includes `chai`). |
| `scripts/deploy.ts` | Deploys all contracts in dependency order with the correct constructor wiring. |
| `src/PDukaToken.sol` | ERC-20 token. Constructor mints supply to the deployer. |
| `src/PDukaOracle.sol` | PDUKA/ZAR price feed. Exposes `pdukaToZar` (rate), `pdukaAmountToZar` (amount conversion), and `updateRates`. |
| `src/PDukaTreasury.sol` | Multi-vault treasury. Constructor takes `(token, oracle)`; reads the live rate; routes incoming funds to logical vaults. |
| `src/PDukaPool.sol` | Pooled custody for all virtual accounts. Constructor `(token, treasury, oracle)`. `batchSettle` takes backend-supplied amounts and uses `usedBatches` replay protection. |
| `src/StakingPool.sol` | Aggregate staking and reward accrual. Supports partial unstake and balance/pending-reward views. |
| `src/SettlementRegistry.sol` | On-chain registry of settlement batches for auditability. |
| `test/*.test.ts` | Mocha + ethers tests, one file per contract. |

---

## 8. `infra` — infrastructure

| Path | Purpose |
|------|---------|
| `infra/docker-compose.yml` | Local development services (PostgreSQL, Redis). Brought up via the root `infra:up` / `infra:down` / `infra:reset` scripts. |

Production infrastructure (AWS af-south-1, ECS Fargate, RDS, ElastiCache) is
described in `INFRASTRUCTURE.md`. Terraform is referenced there as planned but is
not yet committed to this repo.

---

## 9. `.github/workflows` — CI/CD

| File | Purpose |
|------|---------|
| `ci.yml` | Lint, build, and test on pull requests. |
| `contract-deploy.yml` | Compiles and deploys contracts to the configured network. |
| `deploy-staging.yml` | Deploys the API/apps to staging. |
| `deploy-production.yml` | Deploys to production. |

---

## 10. `Docs`, `Deck`, `Website`

| Path | Purpose |
|------|---------|
| `Docs/README.md` | Project overview and entry point. |
| `Docs/STRUCTURE.md` | This document. |
| `Docs/ARCHITECTURE.md` | System architecture, layers, money flows, contracts. |
| `Docs/DATABASE.md` | Authoritative schema reference matching the migration. |
| `Docs/API.md` | REST API specification. |
| `Docs/FRAUDENGINE.md` | Risk-scoring rules and roadmap. |
| `Docs/SECURITY.md` | Auth, encryption, key management. |
| `Docs/INFRASTRUCTURE.md` | Environments, deployment, infrastructure. |
| `Docs/MoscoW.md` | Scope prioritisation (Must/Should/Could/Won't). |
| `Deck/Payduka.pptx`, `Deck/Payduka.pdf` | Pitch deck. |
| `Website/Payduka.html`, `Website/whitepaper.html` | Static marketing page and whitepaper. |

---

## 11. Conventions that apply everywhere

- **Money is integer ZAR cents.** R10.50 is `1050`. Never floats.
- **UUIDs** for all primary keys.
- **Timestamps** are `timestamptz` in UTC.
- **Every balance change writes a ledger entry** inside the same database
  transaction that moved the balance.
- **`@payduka/shared` is the single source of truth** for money-movement enums.
  Do not redefine ledger types inside an app.
- **Migrations, not `synchronize`, own the schema in production.** The runtime
  config sets `synchronize=false` and runs compiled migrations on startup.
- **Tests are the behavioural spec.** Services are written to satisfy the
  `*.service.spec.ts` files; when in doubt, the spec wins.
