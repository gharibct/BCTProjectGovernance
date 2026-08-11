"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import { useAiReview } from "@/components/ai/use-ai-review";
import { usePageBanner } from "@/stores/page-banner";

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
  const setValue = (key: string, value: string) => setM((prev) => ({ ...prev, [key]: value }));
  const setAll = React.useCallback((values: Record<string, string>) => setM(values), []);
  return { m, set, setValue, setAll };
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

// Shared plumbing for every period-keyed Measurement tab (all six Project
// Types except Cloud Migration's own as_of_date-based form): the Reporting
// Period is already chosen on the Project Reporting hub and carried via
// `?period=` (see project-nav.tsx), so it's read-only here rather than a
// second picker. Seeds the entry form from the latest saved record for that
// period once per project (so it doesn't clobber in-progress edits), and
// Save always POSTs a new row for the selected period — same append-only
// pattern as Health Declarations / DE Assessments, since Measurement Entry
// is a periodic snapshot, not a single editable record.
export function useMeasurementForm<TRead extends { id: string; period_id: string }, TPayload>({
  projectId,
  screen,
  latestQuery,
  createMutation,
  toValues,
  toPayload,
}: {
  projectId: string | null;
  screen: string;
  latestQuery: UseQueryResult<TRead | null>;
  createMutation: UseMutationResult<TRead, Error, TPayload>;
  toValues: (data: TRead) => Record<string, string>;
  toPayload: (m: Record<string, string>, periodId: string) => TPayload;
}) {
  const periodId = useSearchParams().get("period") ?? "";
  const latest = latestQuery.data;
  const { m, set, setValue, setAll } = useMeasures();
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const key = latestQuery.isSuccess ? `${latest ? latest.id : "none"}::${periodId}` : null;
  if (key !== null && key !== syncedFor) {
    setSyncedFor(key);
    setAll(latest && latest.period_id === periodId ? toValues(latest) : {});
  }

  const ai = useAiReview(projectId, screen, periodId || null);

  // Pushes pending AI field suggestions straight into `m`, same
  // once-per-distinct-suggestion signature guard as
  // components/ai/use-ai-field-binding.ts's auto-apply effect (this hook
  // predates that one and owns its own `m` state, so it can't reuse it
  // directly — same pattern, applied here instead).
  const appliedSignatures = React.useRef<Map<string, string>>(new Map());
  React.useEffect(() => {
    for (const suggestion of ai.pendingFields) {
      const signature = `${suggestion.id}:${suggestion.value ?? ""}`;
      if (appliedSignatures.current.get(suggestion.field_key) !== signature) {
        appliedSignatures.current.set(suggestion.field_key, signature);
        ai.notePreviousValue(suggestion.field_key, m[suggestion.field_key]);
        setValue(suggestion.field_key, suggestion.value ?? "");
      }
    }
  }, [ai, m, setValue]);

  // Wraps the raw event-based `set` every field's onChange already uses, so
  // a manual edit clears that field's AI indicator (AI-Implementation.md §9)
  // without touching each field's markup.
  const wrappedSet = (fieldKey: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(fieldKey)(e);
    ai.noteManualEdit(fieldKey);
  };

  const submit = () => {
    if (!projectId || !periodId) return;
    createMutation.mutate(toPayload(m, periodId), {
      onSuccess: () => {
        ai.resolveAll();
        showSuccess("Measurement Saved Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to save measurement."),
    });
  };

  return { latest, m, set: wrappedSet, periodId, submit, isSaving: createMutation.isPending, ai };
}
