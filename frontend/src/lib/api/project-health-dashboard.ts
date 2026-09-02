import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

// Project Health dashboard (design-reference/Project-Health.html) — an
// org-wide, portfolio-level KPI page for PMO/Admin/CXO, unlike every other
// dashboard hook in this file which is server-scoped/parameterless: this one
// takes a client-supplied Geo/Account/Project Type/Period filter bar.

export type ProjectPortfolioSummary = {
  total_count: number;
  active_count: number;
  completed_count: number;
  on_hold_count: number;
};

export type ProjectHealthCardSummary = {
  green_count: number;
  amber_count: number;
  potential_red_count: number;
  red_count: number;
  reporting_overdue_count: number;
};

// Account-level RAG rollup — same shape as ProjectHealthCardSummary, but off
// the latest Account Health Declaration per in-scope account.
export type AccountRagCardSummary = {
  green_count: number;
  amber_count: number;
  potential_red_count: number;
  red_count: number;
  reporting_overdue_count: number;
};

export type RiskCardSummary = {
  open_count: number;
  high_critical_count: number;
  overdue_count: number;
  no_mitigation_count: number;
};

export type IssueCardSummary = {
  open_count: number;
  critical_count: number;
  overdue_count: number;
  aging_over_threshold_count: number;
};

export type DependencyCardSummary = {
  open_count: number;
  overdue_count: number;
  critical_count: number;
};

export type AssumptionCardSummary = {
  open_count: number;
  review_due_count: number;
  overdue_count: number;
};

export type OpportunityCardSummary = {
  open_count: number;
  high_priority_count: number;
  pending_approval_count: number;
};

export type MetricsComplianceSummary = {
  compliant_pct: number;
  below_target_count: number;
  not_reported_count: number;
  critical_variance_count: number;
};

export type CommitmentsCardSummary = {
  open_count: number;
  due_soon_count: number;
  overdue_count: number;
  breached_count: number;
};

export type PaymentMilestonesCardSummary = {
  value_due: string;
  due_count: number;
  overdue_count: number;
};

export type ActionsCardSummary = {
  open_count: number;
  in_progress_count: number;
  overdue_count: number;
  due_this_week_count: number;
};

export type FindingsCardSummary = {
  open_count: number;
  new_this_period_count: number;
  overdue_count: number;
  awaiting_closure_count: number;
};

export type DEAssessmentsCardSummary = {
  completed_count: number;
  avg_pci_score: string | null;
  due_count: number;
  red_amber_count: number;
};

export type DataIntegrityCardSummary = {
  overall_compliance_pct: number;
  projects_with_gaps_count: number;
  critical_gaps_count: number;
};

export type ProjectHealthDashboardSummary = {
  portfolio: ProjectPortfolioSummary;
  health: ProjectHealthCardSummary;
  account_health: AccountRagCardSummary;
  risks: RiskCardSummary;
  issues: IssueCardSummary;
  dependencies: DependencyCardSummary;
  assumptions: AssumptionCardSummary;
  opportunities: OpportunityCardSummary;
  metrics: MetricsComplianceSummary;
  commitments: CommitmentsCardSummary;
  payment_milestones: PaymentMilestonesCardSummary;
  actions: ActionsCardSummary;
  findings: FindingsCardSummary;
  de_assessments: DEAssessmentsCardSummary;
  data_integrity: DataIntegrityCardSummary;
  period_id: string | null;
  period_label: string | null;
};

export type ProjectHealthDashboardFilters = {
  geoId?: string;
  accountId?: string;
  projectTypeId?: string;
  periodId?: string;
};

export function useProjectHealthDashboardSummary(filters: ProjectHealthDashboardFilters) {
  const params = new URLSearchParams();
  if (filters.geoId) params.set("geo_id", filters.geoId);
  if (filters.accountId) params.set("account_id", filters.accountId);
  if (filters.projectTypeId) params.set("project_type_id", filters.projectTypeId);
  if (filters.periodId) params.set("period_id", filters.periodId);
  const query = params.toString();

  return useQuery({
    queryKey: ["dashboard-project-health", filters],
    queryFn: () => api.get<ProjectHealthDashboardSummary>(`/dashboard/project-health${query ? `?${query}` : ""}`),
  });
}
