"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";

interface AdvanceRow {
  id: string;
  merchantName: string;
  transactionId: string;
  originalAmount: number;
  advanceAmount: number;
  advanceFee: number;
  status: string;
  createdAt: string;
  settledAt?: string;
}

interface AdvanceStats {
  totalOutstanding: number;
  totalSettled: number;
  totalFeeRevenue: number;
  overdueCount: number;
}

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export default function AdvancesPage() {
  const [rows, setRows] = useState<AdvanceRow[]>([]);
  const [stats, setStats] = useState<AdvanceStats | null>(null);

  useEffect(() => {
    api.get<AdvanceRow[]>("/admin/advances?limit=200").then(setRows);
    api.get<AdvanceStats>("/admin/advance-stats").then(setStats);
  }, []);

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">Card Advances</h2>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Outstanding" value={formatZAR(stats.totalOutstanding)} color="blue" />
          <StatCard label="Settled" value={formatZAR(stats.totalSettled)} color="green" />
          <StatCard label="Fee Revenue" value={formatZAR(stats.totalFeeRevenue)} color="gold" />
          <StatCard label="Overdue" value={stats.overdueCount} color={stats.overdueCount > 0 ? "red" : "green"} />
        </div>
      )}

      <DataTable
        keyField="id"
        data={rows}
        columns={[
          { key: "id", header: "ID", render: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}</span> },
          { key: "merchantName", header: "Merchant" },
          { key: "originalAmount", header: "Txn Amount", align: "right", render: (r) => formatZAR(r.originalAmount) },
          { key: "advanceAmount", header: "Advanced", align: "right", render: (r) => <span className="text-blue">{formatZAR(r.advanceAmount)}</span> },
          { key: "advanceFee", header: "Fee", align: "right", render: (r) => formatZAR(r.advanceFee) },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "createdAt", header: "Created", render: (r) => new Date(r.createdAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) },
          { key: "settledAt", header: "Settled", render: (r) => r.settledAt ? new Date(r.settledAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) : <span className="text-ink-muted">—</span> },
        ]}
      />
    </div>
  );
}
