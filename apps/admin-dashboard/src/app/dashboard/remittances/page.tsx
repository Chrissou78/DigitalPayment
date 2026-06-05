"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

interface RemittanceRow {
  id: string;
  trackingCode: string;
  senderPhone: string;
  recipientPhone: string;
  amount: number;
  senderFee: number;
  status: string;
  sendMerchant: string;
  collectMerchant?: string;
  createdAt: string;
  collectedAt?: string;
}

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export default function RemittancesPage() {
  const [rows, setRows] = useState<RemittanceRow[]>([]);

  useEffect(() => {
    api.get<RemittanceRow[]>("/admin/remittances?limit=200").then(setRows);
  }, []);

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">Remittances</h2>

      <DataTable
        keyField="id"
        data={rows}
        columns={[
          { key: "trackingCode", header: "Code", render: (r) => <span className="font-mono text-gold text-xs">{r.trackingCode}</span> },
          { key: "senderPhone", header: "Sender" },
          { key: "recipientPhone", header: "Recipient" },
          { key: "amount", header: "Amount", align: "right", render: (r) => formatZAR(r.amount) },
          { key: "senderFee", header: "Fee", align: "right", render: (r) => formatZAR(r.senderFee) },
          { key: "sendMerchant", header: "Send Agent" },
          { key: "collectMerchant", header: "Collect Agent", render: (r) => r.collectMerchant ?? <span className="text-ink-muted">—</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "createdAt", header: "Created", render: (r) => new Date(r.createdAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) },
        ]}
      />
    </div>
  );
}
