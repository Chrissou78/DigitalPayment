"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

interface OnChainData {
  poolBalance: string;
  totalBurned: string;
  treasuryBalance: string;
  tokenTotalSupply: string;
  circulatingSupply: string;
  stakingTotalStaked: string;
  stakingApyBps: number;
  poolContractAddress: string;
  tokenContractAddress: string;
  stakingContractAddress: string;
}

export default function OnChainPage() {
  const [data, setData] = useState<OnChainData | null>(null);

  useEffect(() => {
    api.get<OnChainData>("/admin/on-chain").then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ink-muted">Loading on-chain data...</p>
      </div>
    );
  }

  const fmt = (v: string) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">On-Chain Status</h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Pool Balance"
          value={`${fmt(data.poolBalance)} PDUKA`}
          color="gold"
        />
        <StatCard
          label="Total Burned (Lifetime)"
          value={`${fmt(data.totalBurned)} PDUKA`}
          color="red"
        />
        <StatCard
          label="Treasury Balance"
          value={`${fmt(data.treasuryBalance)} PDUKA`}
          color="green"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Supply (Remaining)"
          value={`${fmt(data.tokenTotalSupply)} PDUKA`}
          sub="of 21,000,000,000 minted"
        />
        <StatCard
          label="Staking TVL"
          value={`${fmt(data.stakingTotalStaked)} PDUKA`}
          color="purple"
        />
        <StatCard
          label="Staking APY"
          value={`${(data.stakingApyBps / 100).toFixed(1)}%`}
          color="green"
        />
      </div>

      {/* Contract Links */}
      <div className="bg-surface rounded-xl p-5">
        <h3 className="text-ink font-heading text-base mb-4">Contract Addresses</h3>
        <div className="space-y-3">
          <ContractLink label="PDuka Token" address={data.tokenContractAddress} />
          <ContractLink label="PDuka Pool" address={data.poolContractAddress} />
          <ContractLink label="Staking Pool" address={data.stakingContractAddress} />
        </div>
      </div>
    </div>
  );
}

function ContractLink({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted text-sm">{label}</span>
      <a
        href={`https://polygonscan.com/address/${address}`}
        target="_blank"
        rel="noopener"
        className="text-gold text-sm font-mono underline"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </a>
    </div>
  );
}
