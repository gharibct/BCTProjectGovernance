"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAiReview } from "@/components/ai/use-ai-review";
import { usePageBanner } from "@/stores/page-banner";
import type { MetricReferenceEntry, MetricReferenceLookup } from "@/lib/api/metric-reference";

export const inputClass = "h-11";

export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// String form of a value as it comes back from the API, for seeding an
// editable text input.
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

// Whether a bigger or smaller Computed value is the desired direction for a
// given metric — drives both the Target-vs-Computed color (green = good, red
// = off-target) and the progress bar fill. Metrics with no natural target
// comparison (e.g. counts) don't pass this and stay neutral.
export type MetricDirection = "higher-is-better" | "lower-is-better";

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

// A small round badge for the priority-scoped tiles (SLA Compliance P1/P2/P3,
// Staffing's per-priority Response/Lead Time), replacing a "— P1" suffix in
// the label so the priority reads as a tag rather than part of the title.
function MetricPriorityBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-md bg-[#1a4a7a] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
      {children}
    </span>
  );
}

// (i) icon that opens a popover explaining the metric. When a reference entry
// is available (from GET /metric-reference — every project type except
// Consulting) it shows Unit / Formula / Operational Definition / Benchmark
// Value; otherwise it degrades to just the formula string the call site
// passed inline.
function MetricInfoButton({
  entry,
  fallbackFormula,
}: {
  entry?: MetricReferenceEntry;
  fallbackFormula?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How this metric is calculated"
          className="shrink-0 text-slate-300 transition-colors hover:text-slate-500"
        >
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs text-slate-600">
        {entry ? (
          <dl className="flex flex-col gap-2">
            <div>
              <dt className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Unit</dt>
              <dd>{entry.unit}</dd>
            </div>
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
          </dl>
        ) : (
          (fallbackFormula ?? "No reference available for this metric.")
        )}
      </PopoverContent>
    </Popover>
  );
}

// Label, formula, Target, Computed (color-coded against Target), and a
// progress bar. Target comes from the project's Metric Target (set in New
// Project); Computed is the backend's server-derived value from the latest
// saved Measurement entry for this project — recomputed and persisted at
// save time, not re-derived here, so it always matches exactly what's
// stored. `current === null` renders the whole tile in its muted
// "not computed" state (both Target and Computed as "—"), used for the
// handful of metrics the backend doesn't model (e.g. Cost Performance
// Index) regardless of whether a target value happens to exist for them.
export function MetricTile({
  label,
  metricKey,
  reference,
  formula,
  target,
  current,
  unit,
  direction,
  digits = 2,
  badge,
}: {
  label: string;
  // Looks the metric up in the fetched reference map; the per-priority tiles
  // (SLA/MTTR, response/lead time) all pass the same base key.
  metricKey?: string;
  reference?: MetricReferenceLookup;
  // Fallback formula string for a metric with no reference entry (Consulting).
  formula?: string;
  target: number | null;
  current: number | null;
  // Falls back to the reference entry's unit when omitted.
  unit?: string;
  direction?: MetricDirection;
  digits?: number;
  badge?: string;
}) {
  const entry = metricKey ? reference?.[metricKey] : undefined;
  const displayFormula = entry?.formula ?? formula ?? "";
  const displayUnit = unit ?? entry?.unit ?? "";
  const notComputed = current === null;
  const comparable = !notComputed && target !== null && direction !== undefined;
  const isGood = comparable && (direction === "higher-is-better" ? current >= target : current <= target);
  const progressPct = comparable
    ? clampPct((direction === "higher-is-better" ? current / target : target / current) * 100)
    : 0;

  const computedBoxClass = notComputed
    ? "bg-slate-50"
    : !comparable
      ? "bg-slate-100"
      : isGood
        ? "bg-emerald-100"
        : "bg-red-100";
  const computedTextClass = notComputed
    ? "text-slate-300"
    : !comparable
      ? "text-slate-700"
      : isGood
        ? "text-emerald-700"
        : "text-red-600";
  const barClass = isGood ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="rounded-xl bg-white p-4 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-slate-700 uppercase">{label}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge ? <MetricPriorityBadge>{badge}</MetricPriorityBadge> : null}
          <MetricInfoButton entry={entry} fallbackFormula={formula} />
        </div>
      </div>
      <p className="mt-0.5 text-[11px] italic text-slate-400">{displayFormula}</p>

      <p className="mt-3 text-[10px] font-bold tracking-wide text-slate-400 uppercase">Target</p>
      <div className="mt-1 flex h-11 items-center justify-end rounded-md bg-blue-100 px-2.5">
        <span className="text-lg font-bold text-[#1a4a7a] tabular-nums">
          {target === null ? "—" : target.toFixed(digits)}
        </span>
        {target !== null ? <span className="ml-1 text-[11px] text-[#1a4a7a]/70">{displayUnit}</span> : null}
      </div>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">Computed</p>
      <div className={`mt-1 flex h-11 items-center justify-end rounded-md px-2.5 ${computedBoxClass}`}>
        <span className={`text-lg font-bold tabular-nums ${computedTextClass}`}>
          {notComputed ? "—" : current.toFixed(digits)}
        </span>
        {!notComputed ? <span className="ml-1 text-[11px] opacity-70">{displayUnit}</span> : null}
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        {comparable ? <div className={`h-full rounded-full ${barClass}`} style={{ width: `${progressPct}%` }} /> : null}
      </div>
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
