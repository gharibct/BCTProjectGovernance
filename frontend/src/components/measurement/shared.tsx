"use client";

import * as React from "react";

import { AutoBadge } from "@/components/forms/form-primitives";

export const inputClass = "h-11";

export function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fmt(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

// Ratio helper: a / b, null when either side is missing or b is 0.
export function ratio(a: number | null, b: number | null): number | null {
  return a !== null && b !== null && b > 0 ? a / b : null;
}

export function pct(a: number | null, b: number | null): number | null {
  const r = ratio(a, b);
  return r === null ? null : r * 100;
}

export function useMeasures() {
  const [m, setM] = React.useState<Record<string, string>>({});
  const set =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setM((prev) => ({ ...prev, [key]: e.target.value }));
  return { m, set };
}

export function MetricTile({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <AutoBadge label={note ?? "Auto"} />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
        {value}
        <span className="ml-1.5 text-sm font-medium text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
