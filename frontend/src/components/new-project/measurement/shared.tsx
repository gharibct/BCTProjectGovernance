"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { MetricReferenceEntry, MetricReferenceLookup } from "@/lib/api/metric-reference";

export const inputClass = "h-11";

export function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fmt(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

// The trimmed string when a config benchmark_value is a plain number (e.g.
// "0.45", "95"), else null — the prose benchmarks ("P1 <= 4 hours; …") can't
// prefill a numeric input, so they're shown as a placeholder instead.
export function numericBenchmark(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? t : null;
}

// String form of a target value as it comes back from the API, for seeding
// an editable text input — no rounding, unlike fmt() which is for display.
export function str(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
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
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setM((prev) => ({ ...prev, [key]: e.target.value }));
  const setAll = React.useCallback((values: Record<string, string>) => setM(values), []);
  return { m, set, setAll };
}

// Props shape shared by every per-Project-Type target tab now that
// MeasurementTabs owns the form state (so it can seed it from the saved
// target and wire the shared Save button to it). `reference` is the metric
// reference lookup for the project's type (GET /metric-reference), threaded
// down so each tile's (i) icon can show Unit / Operational Definition / etc.
export type MeasuresProps = {
  m: Record<string, string>;
  set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  reference?: MetricReferenceLookup;
  // Per-field validation messages (keyed by the same field name as `m`), set by
  // the config min/max check in MeasurementTabs when Save Targets is clicked.
  errors?: Record<string, string>;
};

// (i) icon opening a popover with the metric's Unit, Formula, Operational
// Definition and Benchmark Value — the same reference data the Measurement
// Entry screen shows (components/measurement/shared.tsx). When no reference
// entry exists for the metric (e.g. Consulting) it still shows the tile's
// own unit string.
function MetricInfoButton({ entry, unit }: { entry?: MetricReferenceEntry; unit: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Metric definition"
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
        >
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs text-slate-600">
        <dl className="flex flex-col gap-2">
          <div>
            <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Unit</dt>
            <dd>{entry?.unit || unit || "—"}</dd>
          </div>
          {entry ? (
            <>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Formula</dt>
                <dd className="font-medium text-slate-700">{entry.formula}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                  Operational Definition
                </dt>
                <dd>{entry.operational_definition}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                  Benchmark Value
                </dt>
                <dd>{entry.benchmark_value}</dd>
              </div>
            </>
          ) : (
            <p className="text-slate-400">No further reference available for this metric.</p>
          )}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

// Editable — at the planning stage there's no execution data to compute
// metrics from, so each tile is a directly-entered target value rather than
// a locked, formula-derived one.
export function MetricTile({
  label,
  value,
  unit,
  onChange,
  required = true,
  metricKey,
  reference,
  error,
}: {
  label: string;
  value: string;
  unit: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Every metric target feeds the Send To Approval check, so the "*" shows by
  // default; pass required={false} for an optional tile.
  required?: boolean;
  // Looks the metric up in `reference` for the (i) popover; per-priority
  // tiles (Support SLA/MTTR, Staffing response/lead time) pass the shared
  // base key.
  metricKey?: string;
  reference?: MetricReferenceLookup;
  // Config min/max violation message, shown under the input.
  error?: string;
}) {
  const entry = metricKey ? reference?.[metricKey] : undefined;
  // Config (metric_reference.yaml) is the source of truth for the unit; the
  // hard-coded `unit` prop is only a fallback for metrics with no config entry
  // (Consulting). A prose benchmark ("P1 <= 4 hours; …") can't seed the numeric
  // input, so it's offered as a placeholder instead (the numeric ones are
  // prefilled into `value` upstream, in MeasurementTabs).
  const displayUnit = entry?.unit ?? unit;
  const benchmarkPlaceholder =
    entry && numericBenchmark(entry.benchmark_value) === null ? entry.benchmark_value : undefined;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
          {label}
          {required ? (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </p>
        <MetricInfoButton entry={entry} unit={unit} />
      </div>
      <Input
        type="number"
        value={value}
        onChange={onChange}
        placeholder={benchmarkPlaceholder}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        className={cn(
          "mt-2 h-9 w-full bg-white text-right text-base font-bold tabular-nums",
          error && "border-red-500 focus-visible:ring-red-500",
        )}
      />
      <p className="mt-1.5 truncate text-xs font-medium text-slate-500">{displayUnit}</p>
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
