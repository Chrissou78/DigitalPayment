# PayDuka — Africa's Instant Payment Platform

## Overview

PayDuka is a payment platform that eliminates card network fees for African merchants
by routing payments through direct bank-to-bank rails (PayShap, Capitec Pay) and an
auto-refilling wallet system. Merchants save 60-90% on transaction fees compared to
card processing, with instant settlement on wallet payments and optional same-day
advance on card payments.

## The Problem

African merchants lose 2.5-3.5% of every card transaction to Visa/Mastercard interchange,
acquiring banks, and payment processors. Settlement takes 1-3 business days. A merchant
processing R100,000/month loses R30,000-R42,000/year in fees and has constant cash flow
gaps from delayed settlement.

## The Solution

PayDuka provides three payment paths through a single QR-code interface:

1. **Wallet Payment** — Customer pays from auto-refilling PayDuka wallet.
   Fee: R2-R3 flat. Settlement: instant.
2. **Direct Bank Payment** — Customer pays via PayShap/Capitec Pay.
   Fee: R5-R7 flat. Settlement: instant.
3. **Card Payment** — Customer pays with Visa/Mastercard.
   Fee: 2.5-3.5% (standard) + optional 1-1.5% same-day advance fee.
   Settlement: 1-3 days standard, or same-day with advance.

## Tech Stack

- **Backend:** Node.js 20 LTS, NestJS 11, TypeScript 5.x
- **Database:** PostgreSQL 16, Redis 7
- **Mobile Apps:** React Native 0.76+ (Expo)
- **Admin Dashboard:** Next.js 15, React 19
- **Job Queue:** BullMQ
- **Payment Rails:** Stitch API (GraphQL) — PayShap, Capitec Pay, DebiCheck, Card Acquiring
- **Blockchain (Phase 3):** Polygon, ethers.js v6, Solidity 0.8.x
- **Infrastructure:** AWS (af-south-1 Cape Town), ECS Fargate, RDS, ElastiCache, S3, KMS
- **CI/CD:** GitHub Actions
- **Monitoring:** CloudWatch, Sentry

## Project Structure


payduka/ ├── apps/ │ ├── api/ # NestJS backend (monorepo root app) │ ├── merchant-app/ # React Native merchant PoS app │ ├── customer-app/ # React Native customer app │ └── admin-dashboard/ # Next.js admin dashboard ├── packages/ │ ├── shared-types/ # Shared TypeScript types/interfaces │ ├── shared-utils/ # Shared utility functions │ └── api-client/ # Generated API client for frontends ├── infrastructure/ │ ├── docker/ # Docker configs │ ├── terraform/ # AWS infrastructure as code │ └── scripts/ # Deployment and utility scripts ├── docs/ # All project documentation │ ├── architecture.md │ ├── api-spec.md │ ├── database-schema.md │ ├── payment-flows.md │ ├── security.md │ ├── fraud-engine.md │ └── runbooks/ ├── .github/ │ └── workflows/ # CI/CD pipelines ├── docker-compose.yml # Local development environment ├── package.json # Root workspace package.json ├── turbo.json # Turborepo configuration └── README.md


## Getting Started

### Prerequisites

- Node.js 20 LTS
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)

### Local Development

# Clone the repository
git clone https://github.com/payduka/payduka-platform.git
cd payduka-platform

# Install dependencies
npm install

#  environment files
cp apps/api/.env.example apps/api/.env

# Start infrastructure (PostgreSQL, Redis)
docker-compose up -d postgres redis

# Run database migrations
npm run db:migrate --workspace=apps/api

# Seed development data
npm run db:seed --workspace=apps/api

# Start the API in development mode
npm run dev --workspace=apps/api

# In separate terminals:
npm run dev --workspace=apps/admin-dashboard
npm run dev --workspace=apps/merchant-app
npm run dev --workspace=apps/customer-app
Environment Variables
See apps/api/.env.example for the complete list. Critical variables:

DATABASE_URL=postgresql://payduka:payduka@localhost:5432/payduka
REDIS_URL=redis://localhost:6379
STITCH_CLIENT_ID=your_stitch_client_id
STITCH_CLIENT_SECRET=your_stitch_client_secret
STITCH_API_URL=https://api.stitch.money/graphql
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
AWS_KMS_KEY_ID=your_kms_key_id
SENTRY_DSN=your_sentry_dsn
Development Conventions
All monetary values stored as integers in cents (R10.50 = 1050)
All timestamps in UTC, stored as timestamptz in PostgreSQL
All IDs are UUIDs v4
API responses follow a consistent envelope: { data, meta, errors }
Every database mutation creates an audit log entry
Every balance change creates an immutable ledger entry
No direct SQL — all queries through TypeORM repositories
Branch naming: feature/PD-123-description, fix/PD-124-description
Commit messages: conventional commits (feat:, fix:, chore:, docs:)
All PRs require at least one review and passing CI
Documentation Index
Document	Description
Architecture	System architecture, module design, data flow
Database Schema	Complete schema with all tables, indexes, constraints
API Specification	All endpoints, request/response formats, auth
Payment Flows	Detailed flow diagrams for every payment path
Security	Authentication, encryption, key management
Fraud Engine	Risk scoring rules, thresholds, escalation
Deployment	CI/CD pipeline, environments, rollback procedures
Runbooks	Operational procedures for incidents and maintenance