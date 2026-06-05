"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ChartDataPoint } from "@/lib/types";

interface Props {
  data: ChartDataPoint[];
  title: string;
}

export function VolumeChart({ data, title }: Props) {
  return (
    <div className="bg-surface rounded-xl p-5">
      <h3 className="text-ink font-heading text-base mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C8A85C" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#C8A85C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E1E18" />
          <XAxis
            dataKey="date"
            stroke="#A09880"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="#A09880"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `R${(v / 100).toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#141410",
              border: "1px solid #1E1E18",
              borderRadius: 8,
              color: "#F5F0E8",
              fontSize: 13,
            }}
            formatter={(value: number) => [
              `R ${(value / 100).toFixed(2)}`,
              "Volume",
            ]}
          />
          <Area
            type="monotone"
            dataKey="volume"
            stroke="#C8A85C"
            strokeWidth={2}
            fill="url(#goldGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
