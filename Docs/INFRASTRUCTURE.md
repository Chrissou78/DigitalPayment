# PayDuka — Environment & Infrastructure Specification

---

## Environments

| Environment | Purpose | Infrastructure | Data |
|-------------|---------|---------------|------|
| Local | Developer workstation | Docker Compose | Seed data |
| Staging | Integration testing, QA, demo | AWS (minimal) | Synthetic test data |
| Production | Live merchant pilot | AWS (full) | Real data |

---

## Local Development (docker-compose.yml)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: payduka
      POSTGRES_USER: payduka
      POSTGRES_PASSWORD: payduka_local
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]  # SMTP, Web UI

volumes:
  pgdata:

AWS Production Architecture (af-south-1, Cape Town)
Compute
ECS Fargate cluster: payduka-prod
API service: 2x tasks (2 vCPU, 4GB RAM), ALB target group
Worker service: 1x task (1 vCPU, 2GB RAM) — BullMQ processors
Auto-scaling: CPU >70% for 3 min → scale out (max 6 API tasks)
Database
RDS PostgreSQL 16: db.r6g.large (2 vCPU, 16GB RAM)
Multi-AZ deployment for failover
Automated backups: daily, 30-day retention
Read replica (added Phase 3): for analytics queries
Cache
ElastiCache Redis 7: cache.r6g.large
Single node (cluster mode in Phase 3)
Encryption at rest and in transit
Storage
S3 bucket: payduka-kyc-documents-prod (SSE-KMS, versioning enabled)
S3 bucket: payduka-exports-prod (for CSV/PDF exports)
S3 lifecycle: move KYC docs to Glacier after 2 years
Networking
VPC: 10.0.0.0/16
Public subnets: 10.0.1.0/24, 10.0.2.0/24 (ALB only)
Private subnets: 10.0.10.0/24, 10.0.11.0/24 (ECS, RDS, Redis)
NAT Gateway in each AZ for outbound internet (Stitch API calls)
Security
AWS WAF on ALB: managed rule groups + custom rate limits
AWS KMS: customer-managed key for PII encryption
AWS Secrets Manager: database credentials, JWT keys, Stitch API keys
VPC Flow Logs: enabled, sent to CloudWatch
Monitoring
CloudWatch dashboards: API latency, error rates, ECS metrics
CloudWatch alarms:
API p99 latency > 2s → P3 alert
API error rate > 5% → P2 alert
RDS CPU > 80% → P3 alert
Redis memory > 80% → P3 alert
ECS task count = 0 → P1 alert
Sentry: application error tracking with source maps
Custom metric: reconciliation_mismatch_cents → P1 alert if > 0
CI/CD (GitHub Actions)
# .github/workflows/deploy.yml (simplified)
name: Deploy

on:
  push:
    branches: [main]        # → staging
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run test:e2e

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
      - uses: aws-actions/amazon-ecr-login@v2
      - run: docker build -t payduka-api ./apps/api
      - run: docker push $ECR_REGISTRY/payduka-api:$GITHUB_SHA
      - run: |
          aws ecs update-service \
            --cluster payduka-$ENV \
            --service payduka-api \
            --force-new-deployment

Cost Estimate (Monthly, Production)
Service	Specification	Est. Monthly Cost
ECS Fargate (API, 2 tasks)	2 vCPU, 4GB each	$120
ECS Fargate (Worker, 1 task)	1 vCPU, 2GB	$30
RDS PostgreSQL (Multi-AZ)	db.r6g.large	$350
ElastiCache Redis	cache.r6g.large	$180
ALB	Standard	$25
NAT Gateway (2x)	Per AZ	$90
S3	<100GB	$5
CloudWatch	Logs + metrics	$30
KMS	1 key + API calls	$5
Secrets Manager	5 secrets	$5
WAF	Managed rules	$20
Data transfer	~50GB/month	$10
Total		~$870/month
Note: Cape Town region (af-south-1) has approximately 10-15% premium over US regions. This is justified by the latency benefit for South African users and data residency compliance.