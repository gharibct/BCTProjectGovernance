import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { HealthRating } from "./projects";
import type { FindingStatus } from "./de-assessment";

export type ProjectTypeBreakdownRow = {
  project_type_id: string | null;
  project_type_name: string | null;
  count: number;
};

export type ProjectHealthRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  overall_project_health: HealthRating | null;
};

export type AccountHealthRow = {
  account_id: string;
  account_name: string;
  overall_health: HealthRating | null;
  project_count: number;
};

export type ContractualComplianceSummary = {
  met_count: number;
  not_met_count: number;
  not_yet_recorded_count: number;
};

export type MilestonePaymentSummary = {
  upcoming_count: number;
  overdue_count: number;
  paid_count: number;
};

// One row of the Account/Project Governance Matrix — the full 6-category
// breakdown for an account or project, not just the rolled-up overall health
// that AccountHealthRow/ProjectHealthRow expose.
export type HealthMatrixRow = {
  entity_id: string;
  entity_label: string;
  // Populated on project_matrix rows only (which account the project
  // belongs to) — always null on account_matrix rows.
  account_id: string | null;
  account_name: string | null;
  core_delivery_rating: HealthRating | null;
  people_rating: HealthRating | null;
  operational_rating: HealthRating | null;
  customer_rating: HealthRating | null;
  financial_rating: HealthRating | null;
  compliance_rating: HealthRating | null;
  overall_rating: HealthRating | null;
};

export type HighlightRow = {
  entity_id: string;
  entity_label: string;
  category: string;
  description: string;
  created_at: string;
};

// One open Alert (DE assessment finding classified "Alert", still open) — the
// row shape for the "Open Alerts" list section on the PM, Account and CDO
// dashboards.
export type OpenNcRow = {
  finding_id: string;
  project_id: string;
  project_label: string;
  account_name: string | null;
  category: string;
  classification: string;
  description: string | null;
  owner_name: string | null;
  finding_date: string | null;
  due_date: string | null;
  age_days: number | null;
  status: FindingStatus;
};

export type DashboardSummary = {
  active_projects: number;
  projects_by_type: ProjectTypeBreakdownRow[];
  delayed_projects: number;
  open_risks: number;
  open_issues: number;
  pending_approvals: number;
  project_health: ProjectHealthRow[];
  account_health: AccountHealthRow[];
  contractual_compliance: ContractualComplianceSummary;
  milestone_payments: MilestonePaymentSummary;
  account_matrix: HealthMatrixRow[];
  project_matrix: HealthMatrixRow[];
  account_highlights: HighlightRow[];
  project_highlights: HighlightRow[];
  open_ncs_count: number;
  open_ncs: OpenNcRow[];
};

// Role-scoping for the Geo Head / Account Manager dashboards (see
// backend/app/services/dashboard.py's DashboardFilters.geo_ids/account_ids)
// — undefined/empty means unfiltered (CDO/Admin dashboards).
export type DashboardScope = {
  geo_ids?: string[];
  account_ids?: string[];
};

function buildQuery(scope: DashboardScope): string {
  const params = new URLSearchParams();
  for (const id of scope.geo_ids ?? []) params.append("geo_ids", id);
  for (const id of scope.account_ids ?? []) params.append("account_ids", id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useDashboardSummary(scope: DashboardScope, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["dashboard-summary", scope],
    queryFn: () => api.get<DashboardSummary>(`/dashboard/summary${buildQuery(scope)}`),
    enabled: options?.enabled ?? true,
  });
}

// Standalone "Open Alerts" (open Alert-classified findings) for one project /
// account / geo — powers the KPI + list section on the per-entity Project,
// Account and Geo dashboards and their Review screens. scope=account|geo
// rolls up every project under that entity. A live, unfiltered read of every
// currently open Alert regardless of when it was raised — no date cutoff.
export type OpenNcListResponse = {
  open_ncs_count: number;
  open_ncs: OpenNcRow[];
};

export function useOpenNcs(
  scope: "project" | "account" | "geo",
  scopeId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["open-ncs", scope, scopeId],
    queryFn: () =>
      api.get<OpenNcListResponse>(
        `/dashboard/open-ncs?scope=${scope}&scope_id=${encodeURIComponent(scopeId as string)}`,
      ),
    enabled: Boolean(scopeId) && (options?.enabled ?? true),
  });
}

// Open Alerts for a reporting-hub period: while the period's report is still
// Draft/Rejected (or hasn't been created yet), this is a live read of every
// currently open Alert — so an Alert raised, or a finding closed, after the
// report was last saved shows up immediately. Once the report is Submitted
// or Approved it's frozen (mirrors isReportFrozen in lib/api/project-status.ts):
// from that point on this always returns the count/list exactly as they
// stood at submission time, ignoring anything that happens to the
// underlying findings afterwards — closing a finding post-submission must
// not retroactively change a report that's already been filed.
export function useOpenAlertsForReport(
  scope: "project" | "account" | "geo",
  scopeId: string | null | undefined,
  report: { status: string; open_alerts_count: number; open_alerts_snapshot: OpenNcRow[] | null } | undefined
): OpenNcListResponse | undefined {
  const isFrozen = report?.status === "Submitted" || report?.status === "Approved";
  const live = useOpenNcs(scope, scopeId, { enabled: !isFrozen });
  if (isFrozen) {
    return { open_ncs_count: report!.open_alerts_count, open_ncs: report!.open_alerts_snapshot ?? [] };
  }
  return live.data;
}
