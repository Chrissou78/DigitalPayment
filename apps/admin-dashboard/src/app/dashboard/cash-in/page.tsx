"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";

interface CashInRow {
  id: string;
  customerPhone: string;
  merchantName: string;
  amount: number;
  customerFee: number;
  merchantCommission: number;
  status: string;
  createdAt: string;
}

interface CashInStats {
  todayCount: number;
  todayVolume: number;
  weekCount: number;
  weekVolume: number;
  topMerchant: string;
  topMerchantCount: number;
}

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export default function CashInPage() {
  const [rows, setRows] = useState<CashInRow[]>([]);
  const [stats, setStats] = useState<CashInStats | null>(null);

  useEffect(() => {
    api.get<CashInRow[]>("/admin/cash-ins?limit=200").then(setRows);
    api.get<CashInStats>("/admin/cash-in-stats").then(setStats);
  }, []);

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">Cash-In Deposits</h2>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Today" value={stats.todayCount} sub={formatZAR(stats.todayVolume)} color="blue" />
          <StatCard label="This Week" value={stats.weekCount} sub={formatZAR(stats.weekVolume)} color="gold" />
          <StatCard label="Top Agent" value={stats.topMerchant} sub={`${stats.topMerchantCount} deposits`} color="green" />
          <StatCard label="Avg Deposit" value={stats.todayCount > 0 ? formatZAR(stats.todayVolume / stats.todayCount) : "—"} color="purple" />
        </div>
      )}

      <DataTable
        keyField="id"
        data={rows}
        columns={[
          { key: "id", header: "ID", render: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}</span> },
          { key: "customerPhone", header: "Customer" },
          { key: "merchantName", header: "Agent" },
          { key: "amount", header: "Amount", align: "right", render: (r) => formatZAR(r.amount) },
          { key: "customerFee", header: "Fee", align: "right", render: (r) => formatZAR(r.customerFee) },
          { key: "merchantCommission", header: "Commission", align: "right", render: (r) => <span className="text-green">{formatZAR(r.merchantCommission)}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "createdAt", header: "Time", render: (r) => new Date(r.createdAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) },
        ]}
      />
    </div>
  );
}
