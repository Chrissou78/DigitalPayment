"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { VolumeChart } from "@/components/VolumeChart";
import type { DashboardStats, ChartDataPoint } from "@/lib/types";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    api.get<DashboardStats>("/admin/dashboard").then(setStats);
    api.get<ChartDataPoint[]>("/admin/chart/volume?days=30").then(setChartData);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ink-muted">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">Overview</h2>

      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Merchants"
          value={stats.totalMerchants}
          sub={`${stats.activeMerchants} active`}
        />
        <StatCard
          label="Customers"
          value={stats.totalCustomers}
          sub={`${stats.activeCustomers} active`}
          color="blue"
        />
        <StatCard
          label="Today's Transactions"
          value={stats.todayTransactionCount}
          sub={formatZAR(stats.todayTransactionVolume)}
          color="green"
        />
        <StatCard
          label="Fraud Alerts"
          value={stats.fraudAlertsToday}
          sub={`${stats.pendingManualReviews} pending review`}
          color={stats.fraudAlertsToday > 0 ? "red" : "green"}
        />
      </div>

      {/* Row 2: Cash-In & Remittance */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Cash-In Today"
          value={stats.todayCashInCount}
          sub={formatZAR(stats.todayCashInVolume)}
          color="blue"
        />
        <StatCard
          label="Remittances Today"
          value={stats.todayRemittanceCount}
          sub={formatZAR(stats.todayRemittanceVolume)}
          color="purple"
        />
        <StatCard
          label="Outstanding Advances"
          value={formatZAR(stats.totalAdvancesOutstanding)}
          sub={formatZAR(stats.totalReserveHeld) + " reserve"}
          color="gold"
        />
        <StatCard
          label="KYC Pending"
          value={stats.pendingKycReviews}
          color={stats.pendingKycReviews > 0 ? "gold" : "green"}
        />
      </div>

      {/* Row 3: On-Chain */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Pool Balance (On-Chain)"
          value={`${Number(stats.poolBalanceOnChain).toLocaleString()} PDUKA`}
          color="gold"
        />
        <StatCard
          label="Total Burned"
          value={`${Number(stats.totalBurned).toLocaleString()} PDUKA`}
          color="red"
        />
        <StatCard
          label="Treasury Balance"
          value={`${Number(stats.treasuryBalance).toLocaleString()} PDUKA`}
          color="green"
        />
      </div>

      {/* Chart */}
      <VolumeChart data={chartData} title="Transaction Volume (30 Days)" />
    </div>
  );
}
