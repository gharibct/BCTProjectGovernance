import { useQuery } from "@tanstack/react-query";

import { api } from "./client";

// Project Health dashboard (design-reference/Project-Health.html) — an
// org-wide, portfolio-level KPI page for PMO/Admin/CDO, unlike every other
// dashboard hook in this file which is server-scoped/parameterless: this one
// takes a client-supplied Geo/Account/Project Type/Period filter bar.

export type ProjectPortfolioSummary = {
  total_count: number;
  active_count: number;
  completed_count: number;
  on_hold_count: number;
};

// Project / Account health for the selected weekly period. The five counts sum
// to Active Projects / Active Accounts.
export type WeeklyHealthBuckets = {
  green_count: number;
  amber_count: number;
  potential_red_count: number;
  red_count: number;
  not_submitted_count: number;
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

// Per-project Performance dashboard shapes (project-performance.ts) — the
// Project Health dashboard itself uses the bucket types below instead.
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

// Project-level buckets off the previous month's Project Performance report;
// each sums to Active Projects.
export type MetricsBucketSummary = {
  compliant_count: number;
  critical_variance_count: number;
  not_reported_count: number;
};

export type CommitmentsBucketSummary = {
  met_count: number;
  not_met_count: number;
  not_reported_count: number;
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
};

export type FindingsCardSummary = {
  open_count: number;
  overdue_count: number;
  awaiting_closure_count: number;
};

// Project-level DE assessment buckets (previous month's latest Submitted
// assessment); sums to Active Projects.
export type DEAssessmentsCardSummary = {
  green_count: number;
  need_attention_count: number;
  not_assessed_count: number;
};

// "Report Submissions" section — Submitted vs Not Submitted (expected − submitted)
// for the selected week's Delivery Status reports and the previous month's
// Project Performance report.
export type ReportSubmissionKpi = {
  submitted_count: number;
  expected_count: number;
  adherence_pct: number;
};

export type ReportSubmissionsSummary = {
  delivery_status_projects: ReportSubmissionKpi;
  project_performance: ReportSubmissionKpi;
  delivery_status_accounts: ReportSubmissionKpi;
  delivery_status_geos: ReportSubmissionKpi;
};

export type ProjectHealthDashboardSummary = {
  portfolio: ProjectPortfolioSummary;
  health: WeeklyHealthBuckets;
  account_health: WeeklyHealthBuckets;
  risks: RiskCardSummary;
  issues: IssueCardSummary;
  dependencies: DependencyCardSummary;
  assumptions: AssumptionCardSummary;
  opportunities: OpportunityCardSummary;
  metrics: MetricsBucketSummary;
  commitments: CommitmentsBucketSummary;
  payment_milestones: PaymentMilestonesCardSummary;
  actions: ActionsCardSummary;
  findings: FindingsCardSummary;
  de_assessments: DEAssessmentsCardSummary;
  report_submissions: ReportSubmissionsSummary;
  period_id: string | null;
  period_label: string | null;
};

export type ProjectHealthDashboardFilters = {
  geoId?: string;
  // Region + ownership are only wired through the Project Health project list
  // screen's filter bar (showRegion / showOwnership); other screens leave them unset.
  regionId?: string;
  accountId?: string;
  projectTypeId?: string;
  projectOwned?: string;
  periodId?: string;
};

// One entry of the Period combo — Weekly periods only, last 10 incl. the
// current one (newest first, so index 0 is the current week).
export type ProjectHealthPeriod = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

export function useProjectHealthPeriods() {
  return useQuery({
    queryKey: ["dashboard-project-health-periods"],
    queryFn: () => api.get<ProjectHealthPeriod[]>("/dashboard/project-health/periods"),
    staleTime: 5 * 60 * 1000,
  });
}

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
