import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

// Unit / Formula / Operational Definition / Benchmark / min-max, per metric —
// used by the Measurement-tab "(i)" popup, the target-benchmark prefill and the
// Save-Targets range check. Served read-only from GET /metric-reference
// (backend app/data/metric_reference.yaml). Uses the default React Query
// caching (refetch on mount/focus) so an edit to the yaml shows up on the next
// navigation rather than only after a hard refresh.

// A benchmark_value / min_value / max_value triple scoped to one unit of
// measurement — same string conventions as MetricReferenceEntry's own fields.
export type MetricUnitBenchmark = {
  benchmark_value: string;
  min_value: string;
  max_value: string;
};

export type MetricReferenceEntry = {
  key: string;
  label: string;
  unit: string;
  formula: string;
  operational_definition: string;
  benchmark_value: string;
  // Allowed range for a metric target; "" (or non-numeric) means that side is
  // unbounded. Enforced on Save Targets (measurement-tabs.tsx).
  min_value: string;
  max_value: string;
  mandatory: boolean | null;
  // Per-unit-of-measurement benchmark overrides. Only Development's
  // `productivity` populates this today, keyed by Size Unit (CP/FP/LOC/SP).
  benchmark_by_unit?: Record<string, MetricUnitBenchmark> | null;
};

// The benchmark / min / max a metric should show for a given unit of
// measurement: the per-unit override when the entry has one for `unit`,
// otherwise the entry's own scalar values. Returns undefined only when there's
// no entry at all.
export function resolveBenchmark(
  entry: MetricReferenceEntry | undefined,
  unit?: string | null,
): { benchmark_value: string; min_value: string; max_value: string } | undefined {
  if (!entry) return undefined;
  const perUnit = unit ? entry.benchmark_by_unit?.[unit] : undefined;
  return {
    benchmark_value: perUnit?.benchmark_value ?? entry.benchmark_value,
    min_value: perUnit?.min_value ?? entry.min_value,
    max_value: perUnit?.max_value ?? entry.max_value,
  };
}

export type ProjectTypeMetricReference = {
  has_excel_reference: boolean;
  metrics: MetricReferenceEntry[];
  note: string | null;
};

// Keyed by project_types.code (DEVELOPMENT, SUPPORT, …).
export type MetricReferenceResponse = Record<string, ProjectTypeMetricReference>;

// Flat metric-key -> entry map for one project type, for O(1) tile lookups.
export type MetricReferenceLookup = Record<string, MetricReferenceEntry>;

export function useMetricReference() {
  return useQuery({
    queryKey: ["metric-reference"],
    queryFn: () => api.get<MetricReferenceResponse>("/metric-reference"),
  });
}

// Convenience: the per-type flat lookup a measurement form actually needs.
export function useMetricReferenceLookup(projectTypeCode: string): MetricReferenceLookup | undefined {
  const { data } = useMetricReference();
  return React.useMemo(() => {
    const entries = data?.[projectTypeCode]?.metrics;
    if (!entries) return undefined;
    return Object.fromEntries(entries.map((e) => [e.key, e]));
  }, [data, projectTypeCode]);
}
