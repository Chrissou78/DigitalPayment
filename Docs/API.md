Version: 1.0
Base URL: https://api.payduka.co.za/v1

---

## Authentication

All endpoints except /auth/* require a valid JWT Bearer token.

### Headers
Authorization: Bearer <access_token> X-Device-Id: <device_fingerprint> X-App-Version: <app_version> X-Request-Id: (client-generated for idempotency)


### Token Lifecycle
- Access token: 15 minute expiry, signed with RS256.
- Refresh token: 7 day expiry, rotated on each use (old token invalidated).
- MFA required for: merchant withdrawals, advance acceptance, profile changes.

---

## Response Envelope

All responses follow this structure:

```json
{
  "data": { ... },          // Response payload (null on error)
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601",
    "pagination": {          // Present on list endpoints
      "page": 1,
      "pageSize": 20,
      "totalItems": 142,
      "totalPages": 8
    }
  },
  "errors": [                // Present on error (null on success)
    {
      "code": "INSUFFICIENT_BALANCE",
      "message": "Wallet balance is insufficient for this transaction",
      "field": null
    }
  ]
}
Error Codes
Code	HTTP	Description
VALIDATION_ERROR	400	Request body fails validation
INVALID_QR_PAYLOAD	400	QR code data is malformed or expired
UNAUTHORIZED	401	Missing or invalid authentication token
MFA_REQUIRED	401	Operation requires MFA verification
FORBIDDEN	403	User lacks permission for this operation
NOT_FOUND	404	Resource does not exist
INSUFFICIENT_BALANCE	409	Wallet balance too low for operation
WALLET_FROZEN	409	Wallet is frozen due to fraud alert
MERCHANT_SUSPENDED	409	Merchant account is suspended
ADVANCE_NOT_ELIGIBLE	409	Merchant not eligible for advance
ADVANCE_CAP_EXCEEDED	409	Daily advance cap reached
DUPLICATE_REQUEST	409	Idempotent request already processed
TRANSACTION_EXPIRED	410	Transaction TTL exceeded
RATE_LIMITED	429	Too many requests
PAYMENT_RAIL_ERROR	502	External payment provider error
INTERNAL_ERROR	500	Unhandled system error
Endpoints
Auth
POST /auth/register
Register a new customer or merchant account.

Request:

{
  "phoneNumber": "+27821234567",
  "userType": "CUSTOMER",        // or "MERCHANT"
  "firstName": "Thabo",
  "lastName": "Mokoena",
  "pin": "123456"                // 6-digit PIN
}
Response (201):

{
  "data": {
    "userId": "uuid",
    "otpSent": true,
    "otpExpiresAt": "ISO8601"
  }
}
POST /auth/verify-otp
Verify phone number OTP to activate account.

Request:

{
  "phoneNumber": "+27821234567",
  "otp": "482910"
}
Response (200):

{
  "data": {
    "accessToken": "jwt...",
    "refreshToken": "jwt...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "phoneNumber": "+27821234567",
      "userType": "CUSTOMER",
      "kycTier": 1,
      "walletId": "uuid"
    }
  }
}
POST /auth/login
Authenticate with phone number and PIN.

POST /auth/refresh
Exchange refresh token for new access/refresh token pair.

POST /auth/mfa/verify
Verify MFA challenge (SMS OTP or biometric token).

Merchants
POST /merchants/onboard
Complete merchant onboarding (requires MERCHANT user type).

Request:

{
  "businessLegalName": "Thabo's Grocery PTY LTD",
  "businessTradingName": "Thabo's Grocery",
  "registrationNumber": "2024/123456/07",
  "businessType": "PTY_LTD",
  "physicalAddress": {
    "line1": "123 Main Road",
    "line2": "Shop 4",
    "city": "Soweto",
    "province": "Gauteng",
    "postalCode": "1804"
  },
  "settlementBankAccount": {
    "bankId": "capitec",
    "accountNumber": "1234567890",
    "accountHolder": "Thabo Mokoena"
  }
}
Response (201):

{
  "data": {
    "merchantId": "uuid",
    "onboardingStatus": "PENDING",
    "qrCodeId": "PD-M-a1b2c3d4",
    "requiredDocuments": [
      "BUSINESS_REGISTRATION",
      "NATIONAL_ID",
      "PROOF_OF_ADDRESS"
    ]
  }
}
POST /merchants/{id}/documents
Upload KYC document. Multipart form data.

GET /merchants/{id}/qr-code
Get merchant QR code data for display.

Response (200):

{
  "data": {
    "qrCodeId": "PD-M-a1b2c3d4",
    "qrPayload": "payduka://pay?m=PD-M-a1b2c3d4&v=1",
    "qrImageUrl": "https://cdn.payduka.co.za/qr/PD-M-a1b2c3d4.png",
    "merchantName": "Thabo's Grocery"
  }
}
GET /merchants/{id}/dashboard
Get merchant dashboard summary data.

Response (200):

{
  "data": {
    "today": {
      "transactionCount": 47,
      "totalAmountCents": 2350000,
      "totalFeesCents": 14100,
      "walletPayments": 31,
      "cardPayments": 12,
      "bankPayments": 4
    },
    "wallet": {
      "availableBalanceCents": 1850000,
      "pendingBalanceCents": 125000,
      "reservedBalanceCents": 340000
    },
    "advance": {
      "eligible": true,
      "outstandingAmountCents": 450000,
      "dailyCapRemainingCents": 1550000
    }
  }
}
Wallets
GET /wallets/me
Get current user's wallet balance and configuration.

Response (200):

{
  "data": {
    "walletId": "uuid",
    "balances": {
      "available": { "amountCents": 85000, "currency": "ZAR" },
      "pending": { "amountCents": 0, "currency": "ZAR" },
      "reserved": { "amountCents": 0, "currency": "ZAR" }
    },
    "autoRefill": {
      "enabled": true,
      "thresholdCents": 50000,
      "amountCents": 100000,
      "linkedBank": {
        "bankName": "Capitec",
        "accountNumberMasked": "****7890",
        "mandateActive": true
      },
      "lastRefill": {
        "amountCents": 100000,
        "status": "COMPLETED",
        "completedAt": "ISO8601"
      }
    }
  }
}
PUT /wallets/me/auto-refill
Update auto-refill configuration.

Request:

{
  "enabled": true,
  "thresholdCents": 50000,
  "amountCents": 100000
}
POST /wallets/me/link-bank
Initiate bank account linking via Stitch.

Response (200):

{
  "data": {
    "linkUrl": "https://secure.stitch.money/connect/...",
    "sessionId": "uuid",
    "expiresAt": "ISO8601"
  }
}
POST /wallets/me/manual-topup
Initiate a manual top-up via PayShap or EFT.

GET /wallets/me/ledger
Get wallet ledger entries (paginated).

Query params: page, pageSize, fromDate, toDate, balanceType

Transactions
POST /transactions/wallet-payment
Initiate a wallet-to-wallet payment (customer → merchant).

Request:

{
  "qrPayload": "payduka://pay?m=PD-M-a1b2c3d4&v=1",
  "amountCents": 35000,
  "biometricToken": "device_biometric_jwt..."
}
Response (201):

{
  "data": {
    "transactionId": "uuid",
    "status": "COMPLETED",
    "amountCents": 35000,
    "feeCents": 250,
    "merchantName": "Thabo's Grocery",
    "newBalanceCents": 50000,
    "refillTriggered": false,
    "completedAt": "ISO8601"
  }
}
POST /transactions/bank-payment
Initiate a direct bank payment (customer without wallet → merchant).

Response (201):

{
  "data": {
    "transactionId": "uuid",
    "status": "PENDING_PAYMENT",
    "paymentUrl": "https://secure.stitch.money/pay/...",
    "expiresAt": "ISO8601"
  }
}
POST /transactions/card-payment
Initiate a card payment at merchant PoS.

Request:

{
  "merchantId": "uuid",
  "amountCents": 100000,
  "cardToken": "stitch_card_token_..."
}
Response (201):

{
  "data": {
    "transactionId": "uuid",
    "status": "AUTHORIZED",
    "amountCents": 100000,
    "cardFeeCents": 2750,
    "advance": {
      "eligible": true,
      "advanceAmountCents": 96000,
      "advanceFeeCents": 1440,
      "advanceFeeRate": "1.50%"
    }
  }
}
POST /transactions/{id}/accept-advance
Merchant accepts same-day advance on a card payment.

Response (200):

{
  "data": {
    "advanceId": "uuid",
    "advancedAmountCents": 96000,
    "advanceFeeCents": 1440,
    "newWalletBalanceCents": 1946000,
    "expectedSettlementDate": "2026-06-08"
  }
}
POST /transactions/p2p-transfer
Send money to another PayDuka user.

Request:

{
  "recipientPhoneNumber": "+27831234567",
  "amountCents": 50000,
  "note": "Lunch money"
}
GET /transactions
List transactions (paginated, filterable).

Query params: page, pageSize, fromDate, toDate, type, status, minAmountCents, maxAmountCents

GET /transactions/{id}
Get transaction details including full event history.

Settlements
POST /settlements/withdraw
Merchant requests withdrawal to bank account.

Request:

{
  "amountCents": 500000,
  "mfaToken": "otp_verification_token"
}
PUT /settlements/auto-settlement
Configure automatic settlement for merchant.

Request:

{
  "enabled": true,
  "thresholdCents": 1000000,
  "retainCents": 200000
}
GET /settlements
List settlement history (paginated).

Webhooks (Internal — Not Exposed to Clients)
POST /webhooks/stitch
Receive Stitch payment confirmations, refund notifications, etc. Validates webhook signature. Writes to BullMQ for async processing.

Admin (Requires ADMIN role)
GET /admin/transactions
Full transaction search with advanced filters.

GET /admin/merchants
Merchant listing with onboarding status filter.

POST /admin/merchants/{id}/verify
Approve or reject merchant KYC.

GET /admin/fraud-queue
Get transactions pending fraud review.

POST /admin/fraud-queue/{assessmentId}/review
Submit fraud review decision.

GET /admin/reconciliation/daily
Get daily reconciliation report.

GET /admin/dashboard/stats
Get system-wide statistics for admin dashboard.

Response (200):

{
  "data": {
    "today": {
      "totalTransactions": 4521,
      "totalVolumeCents": 225105000,
      "totalFeeRevenueCents": 1125525,
      "totalAdvanceFeeRevenueCents": 340000,
      "activeWallets": 8432,
      "newMerchants": 12,
      "fraudAlerts": 3
    },
    "outstanding": {
      "advanceTotalCents": 4500000,
      "reserveTotalCents": 12300000,
      "pendingKycReviews": 8,
      "pendingFraudReviews": 3
    }
  }
}