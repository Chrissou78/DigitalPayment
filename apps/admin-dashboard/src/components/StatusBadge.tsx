import { clsx } from "clsx";

const variants: Record<string, string> = {
  ACTIVE: "bg-green/10 text-green",
  COMPLETED: "bg-green/10 text-green",
  SETTLED: "bg-green/10 text-green",
  COLLECTED: "bg-green/10 text-green",
  PENDING: "bg-gold/10 text-gold",
  PENDING_PAYMENT: "bg-gold/10 text-gold",
  INITIATED: "bg-gold/10 text-gold",
  AUTHORIZED: "bg-blue/10 text-blue",
  OUTSTANDING: "bg-blue/10 text-blue",
  ESCROWED: "bg-purple/10 text-purple",
  FAILED: "bg-red/10 text-red",
  OVERDUE: "bg-red/10 text-red",
  FLAGGED: "bg-red/10 text-red",
  HIGH: "bg-red/10 text-red",
  MEDIUM: "bg-gold/10 text-gold",
  LOW: "bg-green/10 text-green",
  INACTIVE: "bg-surface-2 text-ink-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = variants[status] ?? "bg-surface-2 text-ink-muted";
  return (
    <span
      className={clsx(
        "inline-block px-2 py-0.5 rounded-md text-xs font-medium uppercase",
        cls
      )}
    >
      {status}
    </span>
  );
}
