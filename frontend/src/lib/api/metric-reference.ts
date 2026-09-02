import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

// Unit / Formula / Operational Definition / Benchmark Value shown in the
// Measurement-tab "how this metric is calculated" popup. Static reference
// data authored from the requirements workbook and served read-only from
// GET /metric-reference (backend app/data/metric_reference.yaml). It only
// ever changes on a redeploy, so it's cached for the whole session.

export type MetricReferenceEntry = {
  key: string;
  label: string;
  unit: string;
  formula: string;
  operational_definition: string;
  benchmark_value: string;
  mandatory: boolean | null;
};

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
    staleTime: Infinity,
    gcTime: Infinity,
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
