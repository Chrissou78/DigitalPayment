export interface DashboardStats {
  totalMerchants: number;
  activeMerchants: number;
  totalCustomers: number;
  activeCustomers: number;
  todayTransactionCount: number;
  todayTransactionVolume: number;
  todayCashInCount: number;
  todayCashInVolume: number;
  todayRemittanceCount: number;
  todayRemittanceVolume: number;
  totalAdvancesOutstanding: number;
  totalReserveHeld: number;
  poolBalanceOnChain: string;
  totalBurned: string;
  treasuryBalance: string;
  pendingKycReviews: number;
  pendingManualReviews: number;
  fraudAlertsToday: number;
}

export interface ChartDataPoint {
  date: string;
  volume: number;
  count: number;
}

export interface MerchantRow {
  id: string;
  businessName: string;
  phone: string;
  kycStatus: string;
  walletAvailable: number;
  walletReserved: number;
  todayVolume: number;
  createdAt: string;
  status: string;
}

export interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount: number;
  fee: number;
  merchantName: string;
  customerPhone: string;
  createdAt: string;
  onChainTxHash?: string;
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  riskLevel: string;
  reason: string;
  merchantName: string;
  amount: number;
  createdAt: string;
  resolved: boolean;
}

export interface SettlementBatch {
  id: string;
  transactionCount: number;
  totalVolume: number;
  burnAmount: string;
  treasuryAmount: string;
  onChainTxHash: string;
  settledAt: string;
}
