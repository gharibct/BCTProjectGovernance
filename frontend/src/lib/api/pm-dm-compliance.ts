import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { ProjectHealthPeriod } from "./project-health-dashboard";

// PM / DM Compliance — GET /dashboard/pm-dm-compliance. Per person, the weekly
// reports owed (as PM of projects / DM of accounts) vs filed, for the weeks
// of the rolling 4 weeks ending at the selected Weekly period.

export type PmDmComplianceCell = { expected: number; submitted: number; on_time: number };

export type PmDmComplianceRow = {
  user_id: string;
  name: string;
  weeks: PmDmComplianceCell[]; // aligned with the response's `weeks`
  expected: number;
  submitted: number;
  on_time: number;
  weeks_fully_submitted: number;
  weeks_owed: number;
};

export type PmDmComplianceResponse = {
  period: { id: string; label: string; start_date: string; end_date: string } | null;
  weeks: { period_id: string; label: string; end_date: string }[];
  rows: PmDmComplianceRow[];
  summary: {
    people: number;
    fully_compliant_people: number;
    expected: number;
    submitted: number;
    on_time: number;
    submitted_pct: number;
    on_time_pct: number;
  };
};

export function usePmDmCompliancePeriods() {
  return useQuery({
    queryKey: ["dashboard-pm-dm-compliance-periods"],
    queryFn: () => api.get<ProjectHealthPeriod[]>("/dashboard/pm-dm-compliance/periods"),
    staleTime: 5 * 60 * 1000,
  });
}

// `periodId` undefined = the latest completed week (the widget).
export function usePmDmCompliance(periodId?: string, enabled = true) {
  const qs = periodId ? `?period_id=${periodId}` : "";
  return useQuery({
    queryKey: ["dashboard-pm-dm-compliance", periodId ?? "latest"],
    queryFn: () => api.get<PmDmComplianceResponse>(`/dashboard/pm-dm-compliance${qs}`),
    enabled,
  });
}
