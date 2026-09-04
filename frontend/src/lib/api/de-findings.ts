import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "./client";
import {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_STATUS_OPTIONS,
  type DEAssessmentFinding,
  type DEAssessmentFindingPayload,
  type FindingCategory,
  type FindingClassification,
  type FindingStatus,
} from "./de-assessment";

export {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_STATUS_OPTIONS,
};
export type { FindingCategory, FindingClassification, FindingStatus };

// The KPI-tile / attention-chip quick filters. One at a time, AND-composed
// with every other filter (see backend services/de_findings.py).
export type DeFindingsBucket =
  | "overdue"
  | "awaiting_closure"
  | "closed_this_period"
  | "overdue_30d"
  | "projects_over_5_open";

export type DeFindingsFilter = {
  geoId?: string;
  accountId?: string;
  projectId?: string;
  classification?: string;
  // A FindingStatus value, "Active" (default — not Closed/Cancelled), or
  // undefined for all.
  status?: string;
  search?: string;
  bucket?: DeFindingsBucket;
};

export type DeFindingRow = {
  id: string;
  project_id: string;
  sequence_no: number;
  category: string;
  classification: FindingClassification;
  description: string | null;
  assigned_to: string | null;
  action_taken: string | null;
  finding_date: string | null;
  due_date: string | null;
  status: FindingStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  project_label: string;
  project_code: string | null;
  project_name: string | null;
  account_name: string | null;
  geo_name: string | null;
  region_name: string | null;
  assignee_name: string | null;
  age_days: number | null;
  overdue: boolean;
};

export type DeFindingsKpis = {
  open_findings: number;
  overdue: number;
  awaiting_closure: number;
  closed_this_period: number;
  overdue_30d_count: number;
  awaiting_closure_count: number;
  projects_over_5_open_count: number;
  period_label: string | null;
};

export type DeFindingCreatePayload = { project_id: string } & DEAssessmentFindingPayload;

function buildParams(p: DeFindingsFilter & { skip?: number; limit?: number }): string {
  const q = new URLSearchParams();
  if (p.geoId) q.set("geo_id", p.geoId);
  if (p.accountId) q.set("account_id", p.accountId);
  if (p.projectId) q.set("project_id", p.projectId);
  if (p.classification) q.set("classification", p.classification);
  if (p.status) q.set("status", p.status);
  if (p.search) q.set("search", p.search);
  if (p.bucket) q.set("bucket", p.bucket);
  if (p.skip !== undefined) q.set("skip", String(p.skip));
  if (p.limit !== undefined) q.set("limit", String(p.limit));
  return q.toString();
}

export function useDeFindings(params: DeFindingsFilter & { skip: number; limit: number }) {
  return useQuery({
    queryKey: ["de-findings", params],
    queryFn: () => api.get<Page<DeFindingRow>>(`/de-findings?${buildParams(params)}`),
  });
}

export function useDeFindingsKpis(params: Pick<DeFindingsFilter, "geoId" | "accountId" | "projectId">) {
  return useQuery({
    queryKey: ["de-findings-kpis", params],
    queryFn: () => api.get<DeFindingsKpis>(`/de-findings/kpis?${buildParams(params)}`),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  queryClient.invalidateQueries({ queryKey: ["de-findings"] });
  queryClient.invalidateQueries({ queryKey: ["de-findings-kpis"] });
  // Keep the project-scoped register (DE Assessment Workspace drawer) and the
  // DE dashboard finding counts in sync.
  queryClient.invalidateQueries({ queryKey: ["de-assessment-findings", projectId] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
}

export function useCreateDeFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DeFindingCreatePayload) =>
      api.post<DEAssessmentFinding>("/de-findings", body),
    onSuccess: (_data, body) => invalidate(queryClient, body.project_id),
  });
}

export function useUpdateDeFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      projectId: string;
      payload: DEAssessmentFindingPayload;
    }) => api.put<DEAssessmentFinding>(`/de-findings/${id}`, payload),
    onSuccess: (_data, vars) => invalidate(queryClient, vars.projectId),
  });
}
