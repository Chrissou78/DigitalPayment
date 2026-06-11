# PayDuka — System Architecture v3.1

> Built for Africa, Powered by Polygon
> Last updated: 2026-06-06

---

## 1. Design Philosophy

PayDuka is a blockchain-powered retail payment platform where users
never know they are using crypto. The entire blockchain layer is
abstracted behind familiar UX patterns: Rand balances, QR payments,
cash deposits, and bank transfers. The blockchain serves three
purposes: deflationary tokenomics (burn), transparent treasury
management, and verifiable audit trail. Everything else happens
off-chain for speed, cost, and simplicity.

---

## 2. System Layers

┌────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                     │
│                                                            │
│ Customer App      Merchant PoS      Admin Panel            │
│ (React Native)    (React Native)    (Next.js)              │
│                                                            │
│ Users see ZAR only.                                        │
│ No wallets.  No gas.  No tokens.                           │
└──────────────────────────────┬─────────────────────────────┘
                               │
                       REST API + WebSocket
                               ▼
┌──────────────────────────────────────────────────────────┐
│                        ENGINE LAYER                      │
│                                                          │
│                   NestJS API   (apps/api/)               │
│  ┌───────────────────────────────────────────────────┐   │
│  │ PostgreSQL      Redis          BullMQ             │   │
│  │ ledger          locks          refill             │   │
│  │ wallets         cache          settlement         │   │
│  │ transactions                   jobs               │   │
│  │ KYC, staking                                      │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│ Source of truth for all balances.                        │
│ Payments, cash-ins, remittances, staking                 │
│ are instant DB operations.  No gas.  No chain.           │
└──────────────────────────────┬───────────────────────────┘
                               │
                  Hourly batch / 10-min oracle
                               ▼
┌──────────────────────────────────────────────────────────┐
│                BLOCKCHAIN LAYER  (Polygon)               │
│                                                          │
│ PDukaToken      PDukaPool       PDukaOracle              │
│ (ERC-20)        (custody)       (PDUKA/ZAR rate)         │
│                                                          │
│ PDukaTreasury               StakingPool                  │
│ (multi-vault,               (APY yield)                  │
│  $100K cap / vault)                                      │
│                                                          │
│ On-chain operations:                                     │
│   batch burn  (0.5% of volume)                           │
│   treasury skim  (2%)                                    │
│   withdrawals / off-ramp                                 │
│   staking deposits / rewards                             │
│                                                          │
│ All verifiable on Polygonscan.                           │
└──────────────────────────────────────────────────────────┘

## 3. Account Model — Virtual Accounts

Every merchant and customer has a virtual account in PostgreSQL.
The Wallet table stores three balances in ZAR cents:

- **available** — spendable balance
- **reserved** — merchant rolling reserve (5% of card transactions)
- **staked** — earning APY, cannot be spent until unstaked

The actual PDuka tokens backing all virtual balances sit in a
single PDukaPool smart contract on Polygon. The pool does not know
about individual users. It only processes aggregate operations:
batch settlement (burn + treasury skim), deposits, and withdrawals.

### The ledger: accounting primitive + business context

Every balance change writes one immutable row to `ledger_entries`. Each row
carries two independent dimensions:

- **type** — the accounting primitive: DEBIT, CREDIT, RESERVE_HOLD,
  RESERVE_RELEASE, STAKE_LOCK, STAKE_UNLOCK, STAKING_REWARD, FEE_REVENUE,
  ADVANCE_CREDIT, ADVANCE_RECOVERY. This matches the database enum exactly.
- **reference_type / reference_id** — the business context and the related
  record: PAYMENT, REMITTANCE, CASH_IN, REFILL, ADVANCE, STAKING, COMMISSION,
  FEE.

Type answers "what kind of movement"; reference answers "because of what". A
customer payment is a DEBIT (reference PAYMENT) on the customer wallet and a
CREDIT (reference PAYMENT) on the merchant wallet, with a separate RESERVE_HOLD
for the rolling reserve and a FEE_REVENUE for the platform fee. Both enums live
once in `@payduka/shared`.

### Why virtual accounts, not per-user wallets?

- **Speed**: DB debit/credit = <50ms. On-chain transfer = 2-5 seconds.
- **Cost**: DB operation = free. On-chain tx = gas fee.
- **UX**: No private keys, no seed phrases, no gas management.
- **Recovery**: Lost phone ≠ lost funds. Re-login with phone + PIN.
- **Offline tolerance**: Works even during chain congestion.
- **Compliance**: Full transaction audit trail in SQL.

---

## 4. Money Flow — Payment Transaction

Customer taps "Pay" → scans merchant QR → confirms amount

POST /transactions (customer app → API)
API validates QR, checks balance, runs fraud scoring
BEGIN DB TRANSACTION a. Lock customer wallet (SELECT FOR UPDATE) b. Lock merchant wallet (SELECT FOR UPDATE) c. Debit customer: available -= amount d. Credit merchant: available += (amount - fee) e. Credit merchant: reserved += (amount × 5%) f. Credit PayDuka: fee_revenue += fee g. Create transaction record, ledger entries, audit log
COMMIT
Return success to customer app
Emit WebSocket event → merchant PoS confirms payment
(Async) Check customer balance → queue auto-refill if low
Total time: <500ms. Zero on-chain interaction.


---

## 5. Money Flow — On-Chain Settlement (Hourly Batch)

SettlementBridgeService (cron, every hour):

Query all COMPLETED transactions with no on-chain batch ID
Sum total volume in ZAR cents
Call PDukaPool.batchSettle(totalVolumeZarCents, batchId)
Pool reads PDukaOracle for current PDUKA/ZAR rate
Pool converts ZAR volume to token amount
Pool burns 0.5% of token volume → sent to 0xdead
Pool sends 2% to PDukaTreasury.receiveFunds()
Treasury auto-routes to sub-vaults ($100K cap each)
Pool emits BatchSettled event
API marks transactions as on-chain settled, stores tx hash

## 6. Money Flow — Withdrawal / Off-Ramp

### Merchant → Bank Account (ZAR)
Merchant requests withdrawal in app
API deducts platform fee from virtual balance
API calls SettlementBridge.withdrawForMerchant()
PDukaPool.withdraw() releases tokens to conversion address
Tokens sold on DEX or via OTC for ZAR
Stitch PayShap sends ZAR to merchant bank account
Merchant sees Rands in their bank, typically same day

### Merchant/Customer → External Crypto Wallet
User provides Polygon wallet address
API deducts platform fee from virtual balance
PDukaPool.withdraw() sends PDuka tokens to their address
User holds actual tokens — can trade, stake externally, etc.

### Customer → Cash-Out at Merchant
Customer requests cash-out in app
Walks to any PayDuka merchant
Merchant confirms collection, hands over cash
API deducts amount + fee from customer virtual balance
API credits merchant virtual balance with commission

## 7. Money Flow — In-App Staking

Users see a simple toggle: "Earn 12% APY on your balance."

### Behind the scenes:
STAKE (instant, off-chain): wallet.available -= amount wallet.staked += amount Ledger entry: STAKE_LOCK
DAILY REWARD DISTRIBUTION (cron): For each wallet where staked > 0: reward = staked × (APY / 365.25) wallet.available += reward Ledger entry: STAKING_REWARD
UNSTAKE (instant, off-chain): wallet.staked -= amount wallet.available += amount Ledger entry: STAKE_UNLOCK
ON-CHAIN SYNC (periodic batch): SettlementBridge aggregates total staked across all users Calls StakingPool.stake() with aggregate amount Claims aggregate rewards, distributes proportionally

Users never interact with the StakingPool contract. They see
their rewards appear in their available balance every day.

## 8. Oracle & Pricing

PDuka is a floating utility token, NOT a stablecoin. Users see
ZAR in the app; the system converts at the current rate.

### PDukaOracle Contract
PDUKA/ZAR = PDUKA/USD × USD/ZAR

Sources: PDUKA/USD → Pre-listing: admin-set (ICO price $0.005) Post-listing: QuickSwap TWAP (on-chain) USD/ZAR → exchangerate-api.com (updated every 10 min) Future: Chainlink USD/ZAR feed on Polygon

Staleness threshold: 1 hour. Settlement fails if rate is stale. Rate snapshot stored with every batch for auditability.


### Rate Update Flow
SettlementBridgeService (cron, every 10 min):

Fetch USD/ZAR from exchangerate-api.com
Call PDukaOracle.updateRates(pdukaUsd, usdZar) with the latest PDUKA/USD
(from config or DEX TWAP) and USD/ZAR rates

---

## 9. Treasury — Multi-Vault Architecture

The protocol treasury receives 2% of all transaction volume.
For security, funds are split across multiple sub-wallets.

### PDukaTreasury Contract
┌─────────────────────────────────┐ 
│        PDukaTreasury            │ 
│ (holds all tokens centrally)    │ 
│                                 │ 
│   Logical vault assignments:    │ 
│      ┌───────┐ ┌───────┐        │ 
│      │Vault 1│ │Vault 2│ ...    │ 
│      │$100K  │ │$100K  │        │ 
│      │ max   │ │ max   │        │ 
│      └───────┘ └───────┘        │ 
│                                 │ 
│   receiveFunds() auto-routes    │ 
│  to first vault with capacity   │ 
│                                 │ 
│   Rebalance when rate changes   │ 
│  (cap is $100K, rate-adjusted)  │  
└─────────────────────────────────┘


Vault addresses are logical labels. All tokens remain physically
inside the treasury contract (no actual transfers to vault
addresses). This means:
- No multi-sig approvals needed for rebalance
- No gas costs for rebalance
- Single contract to audit on Polygonscan
- Easy recovery if a vault label is compromised (just re-assign)

Admin can add/remove vaults, adjust the $100K cap, and trigger
rebalance when the PDUKA price changes significantly.

---

## 10. Smart Contracts Summary

| Contract       | Purpose                                | Key Functions                        |
|----------------|----------------------------------------|--------------------------------------|
| PDukaToken     | ERC-20 token, 21B fixed supply         | transfer, burn                       |
| PDukaPool      | Pooled custody for all virtual accounts| deposit, batchSettle, withdraw       |
| PDukaOracle    | PDUKA/ZAR price feed                   | pdukaToZar, pdukaAmountToZar, updateRates |
| PDukaTreasury  | Multi-vault treasury management        | receiveFunds, disburse, rebalance    |
| StakingPool    | Yield generation for stakers           | stake, unstake, claimRewards         |
| SettlementRegistry | On-chain record of settlement batches | recordBatch, getBatch            |

All contracts deployed on Polygon Mainnet. Addresses stored in
environment config and queryable from the admin dashboard.

---

## 11. Backend Modules

| Module            | Responsibility                                      |
|-------------------|-----------------------------------------------------|
| AuthModule        | JWT, API keys, role guards, biometric token mgmt    |
| MerchantModule    | Onboarding, KYC, profiles                           |
| CustomerModule    | Registration, KYC tiers, profiles                   |
| WalletModule      | Balances (available/reserved/staked), ledger        |
| TransactionModule | POST /transactions, QR validation, debit/credit     |
| CashInModule      | Merchant cash deposits, fee tiers, KYC limits       |
| RemittanceModule  | Send/collect via tracking code, escrow              |
| FraudModule       | Risk scoring, velocity checks, AML flags            |
| PaymentRailModule | Stitch API (PayShap, Capitec Pay, cards)            |
| AdvanceModule     | Card advance engine, eligibility, rolling reserve   |
| RefillModule      | Auto-refill via BullMQ, Redis locks, Stitch pulls   |
| StakingModule     | In-app staking, daily reward distribution           |
| SettlementModule  | Daily batch settlement, reserve release             |
| SettlementBridge  | On-chain batch settlement, oracle updates, off-ramp |
| WebhookModule     | Inbound callbacks from Stitch, signature verify     |
| NotificationModule| WebSocket gateway, push notifications               |
| AdminModule       | Dashboard stats, KYC review, fraud queue            |

---

## 12. Fee Structure

| Event                    | Customer Fee      | Merchant Fee     | Protocol Revenue         |
|--------------------------|-------------------|------------------|--------------------------|
| QR Payment               | —                 | 1.5% of amount   | 1.5% (fee)               |
| Cash-In Deposit          | R2–R25 flat       | —                | R0.50–R8 (from cust fee) |
| Cash-Out at Merchant     | R5–R25 flat       | — (earns comm.)  | R2–R10 (from cust fee)   |
| Remittance Send          | R5–R20 flat       | — (earns comm.)  | R2–R8 (from sender fee)  |
| Remittance Collect       | —                 | — (earns comm.)  | —                        |
| Card Advance             | —                 | 1.5% of advance  | 1.5% (advance fee)       |
| Withdrawal to Bank       | R10 flat          | R15 flat         | Withdrawal fee           |
| Withdrawal to Wallet     | R5 flat           | R10 flat         | Withdrawal fee           |
| On-Chain Burn            | —                 | —                | 0.5% of settled volume   |
| On-Chain Treasury Skim   | —                 | —                | 2.0% of settled volume   |

Fees apply on all movements. Users who hold and stake avoid fees
and earn 8–15% APY — incentivizing retention over withdrawal.

---

## 13. Monorepo Structure

payduka/
├── apps/
│   ├── api/                   # NestJS backend (17 modules)
│   ├── merchant-app/          # React Native (Expo), merchant PoS
│   ├── customer-app/          # React Native (Expo), customer wallet
│   └── admin-dashboard/       # Next.js, operations console
├── packages/
│   └── shared/                # Enums, interfaces, constants, fee tiers
├── contracts/                 # Solidity (Hardhat 3), 6 contracts
│   └── src/
│       ├── PDukaToken.sol
│       ├── PDukaPool.sol
│       ├── PDukaOracle.sol
│       ├── PDukaTreasury.sol
│       ├── StakingPool.sol
│       └── SettlementRegistry.sol
├── docs/
│   ├── ARCHITECTURE.md        # This document
│   └── diagrams/
├── infra/
│   ├── docker-compose.yml     # Redis (Postgres via Supabase or local)
│   └── terraform/
├── package.json               # pnpm workspaces + turborepo
├── turbo.json
└── pnpm-workspace.yaml

## 14. Roadmap Integration

| Phase      | Off-Chain                              | On-Chain                           |
|------------|----------------------------------------|------------------------------------|
| Q1 2026    | API + merchant app pilot               | Deploy token + pool (testnet)      |
| Q2 2026    | 50 merchants, cash-in live             | Mainnet deploy, seed sale via ICO  |
| Q3 2026    | Customer app, remittance, 500 agents   | Oracle live, batch settlement      |
| Q4 2026    | 2,000+ merchants, card advances        | DEX listing, treasury multi-vault  |
| 2027+      | West Africa, SE Asia, 20K+ merchants   | Cross-chain bridges, DAO governance|