import { useQuery } from "@tanstack/react-query";

import { api, type Page } from "./client";
import type { ProjectHealthDashboardFilters } from "./project-health-dashboard";

// Row data behind the Project Health dashboard's drill-down list screens
// (Project List, RAG, Risks, Issues — design-reference/project-health-screens.md).
// Same filter-building convention as project-health-dashboard.ts's
// useProjectHealthDashboardSummary, plus skip/limit paging and a title search.

export type ProjectListRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  project_type_name: string | null;
  geo_name: string | null;
  account_name: string | null;
  project_manager_name: string | null;
  start_date: string | null;
  end_date: string | null;
  overall_health: string | null;
  status: string;
};

export type RagRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  geo_name: string | null;
  account_name: string | null;
  overall_rating: string | null;
  core_delivery_rating: string | null;
  operational_rating: string | null;
  financial_rating: string | null;
  period_label: string | null;
  last_updated: string | null;
};

export type AccountRagRow = {
  account_id: string;
  account_name: string;
  geo_name: string | null;
  project_count: number;
  overall_rating: string | null;
  core_delivery_rating: string | null;
  people_rating: string | null;
  operational_rating: string | null;
  customer_rating: string | null;
  financial_rating: string | null;
  compliance_rating: string | null;
  period_label: string | null;
  last_updated: string | null;
};

export type RiskRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  risk_id: string;
  risk_title: string;
  risk_category: string | null;
  probability: string | null;
  impact: string | null;
  severity: string | null;
  mitigation_plan: string | null;
  owner_name: string | null;
  target_resolution_date: string | null;
  current_status: string;
};

export type IssueRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  issue_id: string;
  issue_title: string;
  issue_category: string | null;
  severity: string | null;
  owner_name: string | null;
  due_date: string | null;
  age_days: number | null;
  status: string;
};

export type DependencyRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  dependency_id: string;
  dependency_title: string;
  category: string | null;
  depends_on: string | null;
  owner_name: string | null;
  due_date: string | null;
  status: string;
};

export type AssumptionRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  assumption_id: string;
  title: string;
  owner_name: string | null;
  review_date: string | null;
  status: string;
};

export type OpportunityRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  opportunity_id: string;
  opportunity_title: string;
  category: string | null;
  priority: string | null;
  owner_name: string | null;
  target_date: string | null;
  status: string;
};

export type MetricRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  metric_name: string;
  target: string | null;
  actual: string | null;
  variance: string | null;
  status: string;
  period_label: string | null;
};

export type CommitmentRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  commitment_id: string;
  commitment_name: string;
  type: string;
  owner_name: string | null;
  due_date: string | null;
  actual_date: string | null;
  status: string;
};

export type PaymentMilestoneRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  milestone_id: string;
  milestone_name: string;
  amount: string | null;
  currency: string | null;
  planned_date: string | null;
  actual_date: string | null;
  status: string;
};

export type AssessmentRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  assessment_id: string;
  pm_health: string | null;
  de_health: string | null;
  pci_score: string | null;
  assessment_period: string | null;
  assessed_by_name: string | null;
  status: string;
};

export type FindingRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  finding_id: string;
  finding_title: string;
  classification: string;
  action_taken: string | null;
  owner_name: string | null;
  due_date: string | null;
  age_days: number | null;
  status: string;
};

export type ActionRow = {
  action_id: string;
  level: string;
  scope_label: string;
  title: string;
  assigned_to_name: string | null;
  due_date: string;
  age_days: number;
  status: string;
};

export type DataIntegrityRow = {
  project_id: string;
  project_label: string;
  geo_name: string | null;
  account_name: string | null;
  item_id: string;
  check_name: string;
  category: string;
  status: string;
  issue: string | null;
  last_checked: string | null;
};

export type ProjectHealthListParams = ProjectHealthDashboardFilters & {
  skip?: number;
  limit?: number;
  search?: string;
};

function buildParams(params: ProjectHealthListParams): string {
  const q = new URLSearchParams();
  if (params.geoId) q.set("geo_id", params.geoId);
  if (params.accountId) q.set("account_id", params.accountId);
  if (params.projectTypeId) q.set("project_type_id", params.projectTypeId);
  if (params.periodId) q.set("period_id", params.periodId);
  if (params.search) q.set("search", params.search);
  q.set("skip", String(params.skip ?? 0));
  q.set("limit", String(params.limit ?? 10));
  return q.toString();
}

export function useProjectHealthProjectList(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-projects", params],
    queryFn: () => api.get<Page<ProjectListRow>>(`/dashboard/project-health/projects?${query}`),
  });
}

export function useProjectHealthRag(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-rag", params],
    queryFn: () => api.get<Page<RagRow>>(`/dashboard/project-health/rag?${query}`),
  });
}

export function useProjectHealthAccountRag(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-account-rag", params],
    queryFn: () => api.get<Page<AccountRagRow>>(`/dashboard/project-health/account-rag?${query}`),
  });
}

export function useProjectHealthRisks(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-risks", params],
    queryFn: () => api.get<Page<RiskRow>>(`/dashboard/project-health/risks?${query}`),
  });
}

export function useProjectHealthIssues(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-issues", params],
    queryFn: () => api.get<Page<IssueRow>>(`/dashboard/project-health/issues?${query}`),
  });
}

export function useProjectHealthDependencies(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-dependencies", params],
    queryFn: () => api.get<Page<DependencyRow>>(`/dashboard/project-health/dependencies?${query}`),
  });
}

export function useProjectHealthAssumptions(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-assumptions", params],
    queryFn: () => api.get<Page<AssumptionRow>>(`/dashboard/project-health/assumptions?${query}`),
  });
}

export function useProjectHealthOpportunities(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-opportunities", params],
    queryFn: () => api.get<Page<OpportunityRow>>(`/dashboard/project-health/opportunities?${query}`),
  });
}

export function useProjectHealthMetrics(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-metrics", params],
    queryFn: () => api.get<Page<MetricRow>>(`/dashboard/project-health/metrics?${query}`),
  });
}

export function useProjectHealthCommitments(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-commitments", params],
    queryFn: () => api.get<Page<CommitmentRow>>(`/dashboard/project-health/commitments?${query}`),
  });
}

export function useProjectHealthPaymentMilestones(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-payment-milestones", params],
    queryFn: () => api.get<Page<PaymentMilestoneRow>>(`/dashboard/project-health/payment-milestones?${query}`),
  });
}

export function useProjectHealthAssessments(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-assessments", params],
    queryFn: () => api.get<Page<AssessmentRow>>(`/dashboard/project-health/assessments?${query}`),
  });
}

export function useProjectHealthFindings(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-findings", params],
    queryFn: () => api.get<Page<FindingRow>>(`/dashboard/project-health/findings?${query}`),
  });
}

export function useProjectHealthActions(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-actions", params],
    queryFn: () => api.get<Page<ActionRow>>(`/dashboard/project-health/actions?${query}`),
  });
}

export function useProjectHealthDataIntegrity(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-data-integrity", params],
    queryFn: () => api.get<Page<DataIntegrityRow>>(`/dashboard/project-health/data-integrity?${query}`),
  });
}
