import { useQuery } from "@tanstack/react-query";

import { api, type Page } from "./client";
import type { ProjectHealthDashboardFilters } from "./project-health-dashboard";

// Row data behind the Project Health dashboard's drill-down list screens
// (Project List, RAG, Risks, Issues — design-reference/project-health-screens.md).
// Same filter-building convention as project-health-dashboard.ts's
// useProjectHealthDashboardSummary, plus skip/limit paging and a title search.

// Display helper for the "Geo" column on every drill-down table: "<Geo> — <Region>"
// when the project has a region, plain "<Geo>" when it does not (region_id is nullable).
export function formatGeoRegion(geoName: string | null, regionName: string | null): string {
  if (!geoName) return "—";
  return regionName ? `${geoName} — ${regionName}` : geoName;
}

export type ProjectListRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  project_type_name: string | null;
  geo_name: string | null;
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
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
  region_name: string | null;
  account_name: string | null;
  finding_id: string;
  finding_title: string;
  category: string;
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
  region_name: string | null;
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

// Single source for the drill-down list endpoint paths — shared by the
// per-screen hooks below and by fetchAllProjectHealthRows (the grids'
// "Download to Excel" action).
export const PROJECT_HEALTH_LIST_PATHS = {
  projects: "/dashboard/project-health/projects",
  rag: "/dashboard/project-health/rag",
  accountRag: "/dashboard/project-health/account-rag",
  risks: "/dashboard/project-health/risks",
  issues: "/dashboard/project-health/issues",
  dependencies: "/dashboard/project-health/dependencies",
  assumptions: "/dashboard/project-health/assumptions",
  opportunities: "/dashboard/project-health/opportunities",
  metrics: "/dashboard/project-health/metrics",
  commitments: "/dashboard/project-health/commitments",
  paymentMilestones: "/dashboard/project-health/payment-milestones",
  assessments: "/dashboard/project-health/assessments",
  findings: "/dashboard/project-health/findings",
  actions: "/dashboard/project-health/actions",
  dataIntegrity: "/dashboard/project-health/data-integrity",
} as const;

// Backend caps the page limit at 200 (pagination_params, le=200), so the
// export walks the endpoint page by page until it has the full result set.
const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_ROWS = 20000;

// Pulls every row matching the current filters — the "Download to Excel"
// action must export the whole filtered result set, not just the page the
// user happens to be looking at.
export async function fetchAllProjectHealthRows<T>(
  path: string,
  params: Omit<ProjectHealthListParams, "skip" | "limit">,
): Promise<T[]> {
  const out: T[] = [];
  for (let skip = 0; skip < EXPORT_MAX_ROWS; skip += EXPORT_PAGE_SIZE) {
    const query = buildParams({ ...params, skip, limit: EXPORT_PAGE_SIZE });
    const page = await api.get<Page<T>>(`${path}?${query}`);
    out.push(...page.items);
    if (page.items.length === 0 || out.length >= page.total) break;
  }
  return out;
}

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
    queryFn: () => api.get<Page<ProjectListRow>>(`${PROJECT_HEALTH_LIST_PATHS.projects}?${query}`),
  });
}

export function useProjectHealthRag(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-rag", params],
    queryFn: () => api.get<Page<RagRow>>(`${PROJECT_HEALTH_LIST_PATHS.rag}?${query}`),
  });
}

export function useProjectHealthAccountRag(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-account-rag", params],
    queryFn: () => api.get<Page<AccountRagRow>>(`${PROJECT_HEALTH_LIST_PATHS.accountRag}?${query}`),
  });
}

export function useProjectHealthRisks(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-risks", params],
    queryFn: () => api.get<Page<RiskRow>>(`${PROJECT_HEALTH_LIST_PATHS.risks}?${query}`),
  });
}

export function useProjectHealthIssues(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-issues", params],
    queryFn: () => api.get<Page<IssueRow>>(`${PROJECT_HEALTH_LIST_PATHS.issues}?${query}`),
  });
}

export function useProjectHealthDependencies(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-dependencies", params],
    queryFn: () => api.get<Page<DependencyRow>>(`${PROJECT_HEALTH_LIST_PATHS.dependencies}?${query}`),
  });
}

export function useProjectHealthAssumptions(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-assumptions", params],
    queryFn: () => api.get<Page<AssumptionRow>>(`${PROJECT_HEALTH_LIST_PATHS.assumptions}?${query}`),
  });
}

export function useProjectHealthOpportunities(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-opportunities", params],
    queryFn: () => api.get<Page<OpportunityRow>>(`${PROJECT_HEALTH_LIST_PATHS.opportunities}?${query}`),
  });
}

export function useProjectHealthMetrics(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-metrics", params],
    queryFn: () => api.get<Page<MetricRow>>(`${PROJECT_HEALTH_LIST_PATHS.metrics}?${query}`),
  });
}

export function useProjectHealthCommitments(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-commitments", params],
    queryFn: () => api.get<Page<CommitmentRow>>(`${PROJECT_HEALTH_LIST_PATHS.commitments}?${query}`),
  });
}

export function useProjectHealthPaymentMilestones(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-payment-milestones", params],
    queryFn: () => api.get<Page<PaymentMilestoneRow>>(`${PROJECT_HEALTH_LIST_PATHS.paymentMilestones}?${query}`),
  });
}

export function useProjectHealthAssessments(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-assessments", params],
    queryFn: () => api.get<Page<AssessmentRow>>(`${PROJECT_HEALTH_LIST_PATHS.assessments}?${query}`),
  });
}

export function useProjectHealthFindings(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-findings", params],
    queryFn: () => api.get<Page<FindingRow>>(`${PROJECT_HEALTH_LIST_PATHS.findings}?${query}`),
  });
}

export function useProjectHealthActions(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-actions", params],
    queryFn: () => api.get<Page<ActionRow>>(`${PROJECT_HEALTH_LIST_PATHS.actions}?${query}`),
  });
}

export function useProjectHealthDataIntegrity(params: ProjectHealthListParams) {
  const query = buildParams(params);
  return useQuery({
    queryKey: ["dashboard-project-health-data-integrity", params],
    queryFn: () => api.get<Page<DataIntegrityRow>>(`${PROJECT_HEALTH_LIST_PATHS.dataIntegrity}?${query}`),
  });
}
