"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/merchants", label: "Merchants" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/cash-in", label: "Cash-In" },
  { href: "/dashboard/remittances", label: "Remittances" },
  { href: "/dashboard/advances", label: "Advances" },
  { href: "/dashboard/fraud", label: "Fraud Alerts" },
  { href: "/dashboard/settlement", label: "Settlement" },
  { href: "/dashboard/on-chain", label: "On-Chain" },
  { href: "/dashboard/kyc", label: "KYC Review" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-surface border-r border-surface-2 flex flex-col py-6">
      <div className="px-5 mb-8">
        <h1 className="font-heading text-gold text-xl">PayDuka</h1>
        <p className="text-ink-muted text-xs">Admin Console</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "block px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === href
                ? "bg-gold/10 text-gold font-medium"
                : "text-ink-muted hover:text-ink hover:bg-surface-2"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-5 pt-4 border-t border-surface-2">
        <p className="text-ink-muted text-xs">v0.1.0</p>
      </div>
    </aside>
  );
}
