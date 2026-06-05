"use client";

import { clsx } from "clsx";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  onRowClick,
  emptyMessage = "No data",
}: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-2">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-2">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "px-4 py-3 text-xs uppercase tracking-wider text-ink-muted font-medium",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-ink-muted text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row[keyField]}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  "border-b border-surface-2 transition-colors",
                  onRowClick
                    ? "cursor-pointer hover:bg-surface-2"
                    : ""
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-4 py-3 text-sm",
                      col.align === "right"
                        ? "text-right font-mono"
                        : "text-left"
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
