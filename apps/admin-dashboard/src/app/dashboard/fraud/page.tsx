"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import type { FraudAlert } from "@/lib/types";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export default function FraudPage() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    api.get<FraudAlert[]>("/admin/fraud-alerts").then(setAlerts);
  }, []);

  const filtered = showResolved
    ? alerts
    : alerts.filter((a) => !a.resolved);

  const resolveAlert = async (id: string) => {
    await api.patch(`/admin/fraud-alerts/${id}`, { resolved: true });
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved: true } : a))
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-ink text-xl">Fraud Alerts</h2>
        <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-gold"
          />
          Show resolved
        </label>
      </div>

      <DataTable
        keyField="id"
        data={filtered}
        columns={[
          {
            key: "riskLevel",
            header: "Risk",
            render: (row) => <StatusBadge status={row.riskLevel} />,
          },
          { key: "reason", header: "Reason" },
          { key: "merchantName", header: "Merchant" },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            render: (row) => formatZAR(row.amount),
          },
          {
            key: "createdAt",
            header: "Time",
            render: (row) =>
              new Date(row.createdAt).toLocaleString("en-ZA", {
                dateStyle: "short",
                timeStyle: "short",
              }),
          },
          {
            key: "actions",
            header: "",
            render: (row) =>
              row.resolved ? (
                <span className="text-green text-xs">Resolved</span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resolveAlert(row.id);
                  }}
                  className="bg-gold/10 text-gold text-xs px-3 py-1 rounded-md hover:bg-gold/20 transition-colors"
                >
                  Resolve
                </button>
              ),
          },
        ]}
      />
    </div>
  );
}
