"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import type { SettlementBatch } from "@/lib/types";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export default function SettlementPage() {
  const [batches, setBatches] = useState<SettlementBatch[]>([]);

  useEffect(() => {
    api.get<SettlementBatch[]>("/admin/settlement-batches").then(setBatches);
  }, []);

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">
        On-Chain Settlement Batches
      </h2>

      <DataTable
        keyField="id"
        data={batches}
        columns={[
          {
            key: "id",
            header: "Batch",
            render: (row) => (
              <span className="font-mono text-xs">{row.id.slice(0, 10)}</span>
            ),
          },
          {
            key: "transactionCount",
            header: "Txns",
            align: "right",
          },
          {
            key: "totalVolume",
            header: "Volume",
            align: "right",
            render: (row) => formatZAR(row.totalVolume),
          },
          {
            key: "burnAmount",
            header: "Burned",
            align: "right",
            render: (row) => (
              <span className="text-red">{row.burnAmount} PDUKA</span>
            ),
          },
          {
            key: "treasuryAmount",
            header: "Treasury",
            align: "right",
            render: (row) => (
              <span className="text-green">{row.treasuryAmount} PDUKA</span>
            ),
          },
          {
            key: "onChainTxHash",
            header: "Tx Hash",
            render: (row) => (
              <a
                href={`https://polygonscan.com/tx/${row.onChainTxHash}`}
                target="_blank"
                rel="noopener"
                className="text-gold text-xs font-mono underline"
              >
                {row.onChainTxHash.slice(0, 10)}…
              </a>
            ),
          },
          {
            key: "settledAt",
            header: "Settled",
            render: (row) =>
              new Date(row.settledAt).toLocaleString("en-ZA", {
                dateStyle: "short",
                timeStyle: "short",
              }),
          },
        ]}
      />
    </div>
  );
}
