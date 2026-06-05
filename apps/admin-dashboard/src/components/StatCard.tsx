import { clsx } from "clsx";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: "gold" | "green" | "red" | "blue" | "purple";
}

const colorMap = {
  gold: "text-gold",
  green: "text-green",
  red: "text-red",
  blue: "text-blue",
  purple: "text-purple",
};

export function StatCard({ label, value, sub, color = "gold" }: Props) {
  return (
    <div className="bg-surface rounded-xl p-5">
      <p className="text-ink-muted text-xs uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={clsx("font-heading text-2xl", colorMap[color])}>
        {value}
      </p>
      {sub && <p className="text-ink-muted text-xs mt-1">{sub}</p>}
    </div>
  );
}
