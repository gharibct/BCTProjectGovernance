"use client";

import * as React from "react";
import { toast } from "sonner";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import { NativeSelect } from "@/components/ui/native-select";
import { Field, MandatoryBadge } from "@/components/forms/form-primitives";
import type { ReportingPeriod } from "@/lib/api/reference-data";

export const inputClass = "h-11";

export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fmt(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

// String form of a value as it comes back from the API, for seeding an
// editable text input — no rounding, unlike fmt() which is for display.
export function str(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function useMeasures() {
  const [m, setM] = React.useState<Record<string, string>>({});
  const set =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setM((prev) => ({ ...prev, [key]: e.target.value }));
  const setAll = React.useCallback((values: Record<string, string>) => setM(values), []);
  return { m, set, setAll };
}

// Four stacked lines: Label, Target, Computed, UOM. Target comes from the
// project's Metric Target (set in New Project); Computed is the backend's
// server-derived value from the latest saved Measurement entry for this
// project — recomputed and persisted at save time, not re-derived here, so
// it always matches exactly what's stored (and correctly shows "—" for the
// handful of metrics the backend doesn't model, e.g. Cost Performance Index).
export function MetricTile({
  label,
  target,
  current,
  unit,
}: {
  label: string;
  target: string;
  current: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-bold tracking-wide text-slate-600 uppercase">
        {label}
      </p>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
        Target
      </p>
      <div className="mt-1 flex h-8 items-center justify-end rounded-md bg-blue-50 px-2.5">
        <span className="text-sm font-semibold text-[#1a4a7a] tabular-nums">
          {target || "—"}
        </span>
      </div>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
        Computed
      </p>
      <div className="mt-1 flex h-8 items-center justify-end rounded-md bg-emerald-50 px-2.5">
        <span className="text-sm font-semibold text-emerald-800 tabular-nums">
          {current}
        </span>
      </div>

      <p className="mt-2 text-right text-xs text-slate-400">{unit}</p>
    </div>
  );
}

export function PeriodField({
  periods,
  value,
  onChange,
}: {
  periods: ReportingPeriod[] | undefined;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <Field label="Reporting Period" htmlFor="reporting-period" badge={<MandatoryBadge />}>
      <NativeSelect id="reporting-period" className="h-10 w-56" value={value} onChange={onChange}>
        <option value="" disabled>
          Select…
        </option>
        {(periods ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

// Shared plumbing for every period-keyed Measurement tab (all six Project
// Types except Cloud Migration's own as_of_date-based form): seeds the entry
// form + selected period from the latest saved record once per project (so
// it doesn't clobber in-progress edits), and Save always POSTs a new row for
// the selected period — same append-only pattern as Health Declarations / DE
// Assessments, since Measurement Entry is a periodic snapshot, not a single
// editable record.
export function useMeasurementForm<TRead extends { id: string; period_id: string }, TPayload>({
  projectId,
  latestQuery,
  createMutation,
  toValues,
  toPayload,
}: {
  projectId: string | null;
  latestQuery: UseQueryResult<TRead | null>;
  createMutation: UseMutationResult<TRead, Error, TPayload>;
  toValues: (data: TRead) => Record<string, string>;
  toPayload: (m: Record<string, string>, periodId: string) => TPayload;
}) {
  const latest = latestQuery.data;
  const { m, set, setAll } = useMeasures();
  const [periodId, setPeriodId] = React.useState("");
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);

  const key = latest ? latest.id : latest === null ? "none" : null;
  if (key !== null && key !== syncedFor) {
    setSyncedFor(key);
    if (latest) {
      setAll(toValues(latest));
      setPeriodId(latest.period_id);
    }
  }

  const submit = () => {
    if (!projectId || !periodId) return;
    createMutation.mutate(toPayload(m, periodId), {
      onSuccess: () => toast.success("Measurement Saved Successfully"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save measurement."),
    });
  };

  return { latest, m, set, periodId, setPeriodId, submit, isSaving: createMutation.isPending };
}
