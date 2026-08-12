import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { HealthRating } from "./projects";

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
};

// Role-scoping for the Geo Head / Account Manager dashboards (see
// backend/app/services/dashboard.py's DashboardFilters.geo_ids/account_ids)
// — undefined/empty means unfiltered (CXO/Admin dashboards).
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
