"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import type { TransactionRow } from "@/lib/types";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

const TYPE_FILTERS = ["ALL", "PAYMENT", "CASH_IN", "REMITTANCE", "ADVANCE", "REFILL"];

export default function TransactionsPage() {
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<TransactionRow[]>("/admin/transactions?limit=200").then(setTxns);
  }, []);

  const filtered = txns.filter((t) => {
    if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
    if (
      search &&
      !t.id.includes(search) &&
      !t.merchantName.toLowerCase().includes(search.toLowerCase()) &&
      !(t.customerPhone ?? "").includes(search)
    )
      return false;
    return true;
  });

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">Transactions</h2>

      <div className="flex items-center gap-3 mb-4">
        {/* Type filter pills */}
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          {TYPE_FILTERS.map((tf) => (
            <button
              key={tf}
              onClick={() => setTypeFilter(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === tf
                  ? "bg-gold text-bg"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search ID, merchant, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface-2 border border-surface-3 rounded-lg px-4 py-2 text-ink text-sm w-64 outline-none focus:border-gold transition-colors ml-auto"
        />
      </div>

      <DataTable
        keyField="id"
        data={filtered}
        columns={[
          {
            key: "id",
            header: "ID",
            render: (row) => (
              <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (row) => (
              <span className="text-xs uppercase text-ink-muted">{row.type}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: "merchantName", header: "Merchant" },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            render: (row) => formatZAR(row.amount),
          },
          {
            key: "fee",
            header: "Fee",
            align: "right",
            render: (row) => formatZAR(row.fee),
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
            key: "onChainTxHash",
            header: "On-Chain",
            render: (row) =>
              row.onChainTxHash ? (
                <a
                  href={`https://polygonscan.com/tx/${row.onChainTxHash}`}
                  target="_blank"
                  rel="noopener"
                  className="text-gold text-xs underline"
                >
                  {row.onChainTxHash.slice(0, 8)}…
                </a>
              ) : (
                <span className="text-ink-muted text-xs">—</span>
              ),
          },
        ]}
      />
    </div>
  );
}
