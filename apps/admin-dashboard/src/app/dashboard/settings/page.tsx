"use client";

import { useRouter } from "next/navigation";
import { clearAdminToken } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = () => {
    clearAdminToken();
    router.push("/");
  };

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">Settings</h2>

      <div className="max-w-lg space-y-4">
        <div className="bg-surface rounded-xl p-5">
          <h3 className="text-ink font-heading text-base mb-2">
            API Configuration
          </h3>
          <p className="text-ink-muted text-sm mb-3">
            Connected to:{" "}
            <code className="text-gold text-xs bg-surface-2 px-2 py-0.5 rounded">
              {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"}
            </code>
          </p>
        </div>

        <div className="bg-surface rounded-xl p-5">
          <h3 className="text-ink font-heading text-base mb-2">
            Contract Addresses
          </h3>
          <p className="text-ink-muted text-sm">
            View deployed contract addresses and on-chain data in the{" "}
            <a href="/dashboard/on-chain" className="text-gold underline">
              On-Chain
            </a>{" "}
            section.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-red/10 border border-red/30 text-red font-heading text-sm rounded-xl py-3 hover:bg-red/20 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
