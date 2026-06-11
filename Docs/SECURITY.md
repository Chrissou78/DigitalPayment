# PayDuka — Security Specification

Version: 1.1
Last Updated: 2026-06-06

> Status: this document describes the target security posture. Controls tied to
> AWS (KMS, WAF, Secrets Manager, ACM, VPC) describe the production design and
> are not part of the current local/dev build. The JWT subsection notes current
> versus planned behaviour. The runbooks referenced in section 5 live under a
> `Docs/runbooks/` folder that is planned and not yet committed.

---

## 1. Authentication & Authorization

### 1.1 Customer Authentication

- Registration: Phone number + 6-digit PIN + SMS OTP verification
- Login: Phone number + PIN → JWT issued
- Payment authorization: Biometric (fingerprint/face) via device-local
  authentication → biometric token sent with payment request
- High-value operations (>R5,000 single txn, withdrawal): SMS OTP re-verification

### 1.2 Merchant Authentication

- Registration: Phone number + email + password (min 12 chars, complexity enforced)
  + SMS OTP verification
- Login: Email + password → JWT issued
- All financial operations: SMS OTP as second factor
- PoS app: Device-bound session with biometric unlock

### 1.3 Admin Authentication

- Email + password + mandatory TOTP (Google Authenticator / Authy)
- Session timeout: 30 minutes idle, 8 hours absolute
- IP allowlist for admin dashboard access (configurable)

### 1.4 JWT Configuration

- Algorithm: RS256 (asymmetric — public key distributed to services,
  private key held only by AuthModule)
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days, single-use (rotated on each refresh)
- Payload: { sub: userId, type: userType, roles: [], deviceId, iat, exp }

**Current implementation.** The backend today signs with a single shared secret
(`JWT_SECRET`) and a single access token whose lifetime is `JWT_EXPIRATION`
(default 3600 seconds). RS256 asymmetric signing, 15-minute access tokens, and
single-use refresh-token rotation described above are the planned hardening, not
the current behaviour.

### 1.5 Role-Based Access Control

| Role | Scope |
|------|-------|
| CUSTOMER | Own wallet, own transactions, own profile |
| MERCHANT | Own merchant data, own wallet, own transactions, own PoS |
| VIEWER | Read-only admin dashboard |
| OPERATOR | VIEWER + merchant verification + standard withdrawal approval |
| RISK_ANALYST | OPERATOR + fraud queue review + merchant risk adjustment |
| ADMINISTRATOR | Full access including system configuration |

**Current implementation.** The committed `Role` enum is `CUSTOMER`, `MERCHANT`,
`AGENT`, `ADMIN`. The finer admin sub-roles above (VIEWER, OPERATOR,
RISK_ANALYST, ADMINISTRATOR) are the planned breakdown of `ADMIN`.

---

## 2. Encryption

### 2.1 Data at Rest

- All PII fields (ID numbers, bank account numbers) encrypted with AES-256-GCM
  using keys managed by AWS KMS (af-south-1 region)
- Key rotation: automatic annual rotation via KMS, with ability to decrypt
  using previous key versions
- PostgreSQL RDS encryption: enabled (AES-256, AWS-managed key)
- S3 bucket encryption: SSE-KMS for KYC documents
- Redis ElastiCache encryption: at-rest encryption enabled

### 2.2 Data in Transit

- TLS 1.3 enforced on all external connections (API, webhooks, Stitch)
- TLS 1.2 minimum for internal connections (RDS, ElastiCache)
- Certificate management: AWS Certificate Manager (ACM) with auto-renewal
- HSTS header: max-age=31536000; includeSubDomains

### 2.3 Sensitive Data Handling

- Raw card data: NEVER enters PayDuka systems. Handled exclusively by
  Stitch's PCI-DSS compliant infrastructure. PayDuka receives only
  tokenized card references.
- PINs: Stored as bcrypt hashes (cost factor 12). Never logged or
  transmitted after initial hashing.
- Bank account numbers: Encrypted at rest. Displayed masked in UI
  (****7890). Full number accessible only to settlement service.
- Phone numbers: Stored in plain text (needed for lookups). Considered
  PII for export/deletion purposes.

---

## 3. API Security

- Rate limiting: Per-endpoint limits enforced at AWS WAF and application level
  - Auth endpoints: 5 requests/15 min per IP
  - Payment endpoints: 30 requests/min per user
  - Read endpoints: 100 requests/min per user
- Input validation: NestJS ValidationPipe with class-validator on every endpoint
- SQL injection: Prevented by TypeORM parameterized queries (no raw SQL)
- XSS: Response Content-Type always application/json; admin dashboard uses
  React (auto-escaping)
- CORS: Whitelist of allowed origins (mobile apps use device tokens, not CORS)
- Request size limit: 1MB (10MB for KYC document uploads)
- Idempotency: X-Request-Id header required on all mutation endpoints.
  Duplicate requests return cached response.

---

## 4. Infrastructure Security

- VPC: All services in private subnets. Only ALB in public subnet.
- Security groups: Minimal port exposure. RDS only accessible from ECS tasks.
  Redis only accessible from ECS tasks.
- IAM: Least-privilege roles per service. ECS task roles scoped to specific
  KMS keys, S3 buckets, and SQS queues.
- Secrets: AWS Secrets Manager for database credentials, API keys, JWT
  signing keys. Never in environment variables or code.
- Logging: All access logs to CloudWatch. No PII in log messages.
  Structured JSON logging with correlation IDs.
- WAF: AWS WAF with managed rule groups (common threats, SQL injection,
  known bad inputs) on ALB.

---

## 5. Incident Response

### 5.1 Severity Classification

- **P1 (Critical):** Payment processing failure, data breach, unauthorized
  fund access. Response: <15 minutes. All hands.
- **P2 (High):** Single payment rail failure, fraud spike, partial service
  degradation. Response: <1 hour. On-call engineer + CTO.
- **P3 (Medium):** Non-critical feature failure, elevated error rates,
  single merchant issue. Response: <4 hours. On-call engineer.
- **P4 (Low):** Cosmetic issues, non-blocking bugs. Response: next
  business day.

### 5.2 Runbook Locations

All operational runbooks stored in `docs/runbooks/`:
- `payment-rail-failure.md` — Steps when Stitch API is unavailable
- `database-failover.md` — RDS failover procedure
- `fraud-incident.md` — Steps when fraud is detected
- `wallet-reconciliation-mismatch.md` — When ledger doesn't match bank
- `advance-pool-low.md` — When advance liquidity pool is running low