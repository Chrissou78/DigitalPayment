# PayDuka — Africa's Instant Payment Platform

Version: 2.0
Last Updated: 2026-06-06

## Overview

PayDuka eliminates card-network fees for African merchants by routing payments
through direct bank-to-bank rails (PayShap, Capitec Pay) and an auto-refilling
wallet system. Merchants save 60-90% on transaction fees versus card processing,
with instant settlement on wallet payments and optional same-day advance on card
payments.

A blockchain layer (Polygon) sits underneath for deflationary burn, transparent
treasury, and a verifiable audit trail, but users never see it. Everyone
transacts in Rands.

## The Problem

African merchants lose 2.5-3.5% of every card transaction to interchange,
acquiring banks, and processors, and wait 1-3 business days for settlement. A
merchant doing R100,000/month loses R30,000-R42,000/year in fees and lives with
constant cash-flow gaps.

## The Solution

Three payment paths through one QR interface:

1. **Wallet payment** — customer pays from an auto-refilling PayDuka wallet. Fee
   ~1.5%. Settlement: instant.
2. **Direct bank payment** — customer pays via PayShap/Capitec Pay. Flat fee.
   Settlement: instant.
3. **Card payment** — customer pays by card. Standard card fee, plus an optional
   same-day advance fee. Settlement: 1-3 days, or same-day with advance.

## Tech Stack

- **Backend:** Node.js 20 LTS, NestJS 11, TypeScript 5
- **Database:** PostgreSQL 16, Redis 7
- **Job queue:** BullMQ
- **Mobile apps:** React Native 0.76+ (Expo), NativeWind, Zustand
- **Admin dashboard:** Next.js 15, React 19, Tailwind
- **Payment rails:** Stitch API (GraphQL) — PayShap, Capitec Pay, DebiCheck, card acquiring
- **Blockchain:** Polygon, Solidity 0.8.24, Hardhat 3, ethers v6
- **Tooling:** pnpm workspaces, Turborepo
- **Infrastructure:** AWS af-south-1 (Cape Town), ECS Fargate, RDS, ElastiCache
- **CI/CD:** GitHub Actions

## Project Structure

```
DigitalPayment/                 repo root (product: PayDuka)
├── apps/
│   ├── api/                    NestJS backend — source of truth for all money
│   ├── merchant-app/           React Native (Expo) merchant PoS
│   ├── customer-app/           React Native (Expo) customer wallet
│   └── admin-dashboard/        Next.js operations console
├── packages/
│   └── shared/                 shared enums, interfaces, constants (@payduka/shared)
├── contracts/                  Solidity (Hardhat 3): 6 contracts + tests
├── infra/
│   └── docker-compose.yml      local Postgres + Redis
├── Docs/                       project documentation (see index below)
├── Deck/                       pitch deck (pptx + pdf)
├── Website/                    static marketing page + whitepaper
├── .github/workflows/          CI/CD pipelines
├── package.json                workspace scripts + Turborepo
├── turbo.json                  Turborepo pipeline
└── pnpm-workspace.yaml         workspace globs
```

For a file-by-file walkthrough, see `STRUCTURE.md`.

## Getting Started

### Prerequisites

- Node.js 20 LTS
- pnpm 9 (`corepack enable` then `corepack prepare pnpm@9 --activate`)
- Docker & Docker Compose (for Postgres + Redis)

### Local development

```bash
# Install all workspace dependencies
pnpm install

# Start local infrastructure (Postgres + Redis)
pnpm infra:up

# Configure the API environment
cp apps/api/.env.example apps/api/.env   # then edit values

# Run database migrations (from the API workspace)
pnpm --filter @payduka/api migration:run

# Start the API in dev mode
pnpm dev:api

# In separate terminals, start the frontends as needed
pnpm dev:merchant
pnpm dev:customer
pnpm dev:admin
```

Useful root scripts: `pnpm build:all`, `pnpm test:all`, `pnpm lint:all`,
`pnpm infra:down`, `pnpm infra:reset`, `pnpm contracts:test`,
`pnpm contracts:deploy:testnet`, `pnpm contracts:deploy:mainnet`.

### Key environment variables

Set these in `apps/api/.env` (see `config/configuration.ts` for the full list):

```
DATABASE_URL=postgresql://payduka:payduka_secret@localhost:5432/payduka
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret_min_32_chars
STITCH_CLIENT_ID=...
STITCH_CLIENT_SECRET=...
STITCH_API_URL=https://api.stitch.money/graphql
ADMIN_DEFAULT_EMAIL=admin@payduka.xyz
ADMIN_DEFAULT_PASSWORD=change-me
```

## Tests

```bash
# API unit tests (Jest)
pnpm --filter @payduka/api test

# Smart-contract tests (Hardhat)
pnpm contracts:test
```

Current state: API at 27 passing tests across 7 suites; contracts at 21 Mocha
tests plus 21 Solidity tests. Service code is written to satisfy the
`*.service.spec.ts` files, which act as the behavioural spec.

## Development Conventions

- All monetary values are integer ZAR cents (R10.50 = `1050`).
- All timestamps are `timestamptz` in UTC.
- All primary keys are UUIDs.
- API responses use a consistent envelope: `{ data, meta, errors }`.
- Every balance change writes an immutable `ledger_entries` row in the same
  transaction.
- Money-movement enums live once in `@payduka/shared`; never redefine them in an
  app.
- Schema changes go through migrations, never `synchronize` in production.
- No raw SQL in services — go through TypeORM repositories. (Raw SQL is used
  only inside migration files.)
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`); PRs need a review
  and green CI.

## Documentation Index

| Document | Description |
|----------|-------------|
| `STRUCTURE.md` | Repository layout and a description of every significant file |
| `ARCHITECTURE.md` | System layers, money flows, smart contracts, modules |
| `DATABASE.md` | Authoritative schema reference matching the migration |
| `API.md` | REST API specification: endpoints, envelope, error codes |
| `FRAUDENGINE.md` | Risk-scoring rules, thresholds, and roadmap |
| `SECURITY.md` | Authentication, encryption, key management |
| `INFRASTRUCTURE.md` | Environments, deployment, infrastructure |
| `MoscoW.md` | Scope prioritisation (Must / Should / Could / Won't) |
