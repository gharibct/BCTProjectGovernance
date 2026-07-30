"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

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

// Editable — at the planning stage there's no execution data to compute
// metrics from, so each tile is a directly-entered target value rather than
// a locked, formula-derived one.
export function MetricTile({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: string;
  unit: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <Input
        type="number"
        value={value}
        onChange={onChange}
        aria-label={label}
        className="mt-2 h-9 w-full bg-white text-right text-base font-bold tabular-nums"
      />
      <p className="mt-1.5 truncate text-xs font-medium text-slate-500">{unit}</p>
    </div>
  );
}
