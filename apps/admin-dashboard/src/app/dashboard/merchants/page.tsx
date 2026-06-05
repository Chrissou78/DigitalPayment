"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import type { MerchantRow } from "@/lib/types";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<MerchantRow[]>("/admin/merchants").then(setMerchants);
  }, []);

  const filtered = merchants.filter(
    (m) =>
      m.businessName.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.id.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-ink text-xl">Merchants</h2>
        <input
          type="text"
          placeholder="Search by name, phone, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface-2 border border-surface-3 rounded-lg px-4 py-2 text-ink text-sm w-72 outline-none focus:border-gold transition-colors"
        />
      </div>

      <DataTable
        keyField="id"
        data={filtered}
        columns={[
          { key: "businessName", header: "Business" },
          { key: "phone", header: "Phone" },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "kycStatus",
            header: "KYC",
            render: (row) => <StatusBadge status={row.kycStatus} />,
          },
          {
            key: "walletAvailable",
            header: "Balance",
            align: "right",
            render: (row) => formatZAR(row.walletAvailable),
          },
          {
            key: "todayVolume",
            header: "Today",
            align: "right",
            render: (row) => formatZAR(row.todayVolume),
          },
          {
            key: "createdAt",
            header: "Joined",
            render: (row) =>
              new Date(row.createdAt).toLocaleDateString("en-ZA"),
          },
        ]}
      />
    </div>
  );
}
