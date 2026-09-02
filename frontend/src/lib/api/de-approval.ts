import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { ProjectStatus } from "./projects";

// DE Project Approval (design-reference/de-approval) — the allocated Delivery
// Excellence assessor reviews governance completeness module by module and
// Approves or Returns the project. The queue is scoped server-side to the
// signed-in DE's allocations; period_id is a display filter only.

export type DeReviewStatus = "In Review" | "Returned" | "Approved";
export type DeModuleReviewAction = "Not Reviewed" | "Reviewed" | "Gap Identified";
export type GovernanceModuleKey =
  | "project_profile"
  | "scope_schedule"
  | "map_oracle_projects"
  | "contractual_compliance"
  | "raido"
  | "measurement";

export const MODULE_REVIEW_ACTIONS: DeModuleReviewAction[] = [
  "Not Reviewed",
  "Reviewed",
  "Gap Identified",
];

// Where each checklist row's "View" link goes — dedicated read-only
// /de-approval/{projectId}/{path} module views owned by this feature (no edit
// affordances, no editable sibling route).
export const MODULE_VIEW_PATH: Record<GovernanceModuleKey, string> = {
  project_profile: "project-profile",
  scope_schedule: "scope-schedule",
  map_oracle_projects: "oracle-mapping",
  contractual_compliance: "contractual",
  raido: "raido",
  measurement: "measurement",
};

export type GovernanceModuleStatus = {
  key: GovernanceModuleKey;
  label: string;
  mandatory: boolean;
  complete: boolean;
  gaps: string | null;
  review_action: DeModuleReviewAction;
  last_updated: string | null;
  // Partial progress: required fields filled / required fields expected.
  fields_complete: number;
  fields_total: number;
  progress_pct: number;
};

export type GovernanceCompleteness = {
  completion_pct: number;
  modules_complete: number;
  modules_incomplete: number;
  gaps_count: number;
  critical_gaps: number;
  modules: GovernanceModuleStatus[];
};

export type DeApprovalKpis = {
  awaiting_review: number;
  in_review: number;
  returned: number;
};

export type DeApprovalQueueRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  account_name: string | null;
  geo_name: string | null;
  region_name: string | null;
  project_type_name: string | null;
  project_manager_name: string | null;
  completion_pct: number;
  gaps_count: number;
  project_status: ProjectStatus;
  de_review_status: DeReviewStatus | null;
  last_updated: string;
  href: string;
};

export type DeApprovalQueueResponse = {
  period_id: string | null;
  kpis: DeApprovalKpis;
  rows: DeApprovalQueueRow[];
};

export type DeReviewDetail = {
  project_id: string;
  project_code: string;
  project_name: string;
  account_name: string | null;
  project_manager_name: string | null;
  project_status: ProjectStatus;
  de_review_status: DeReviewStatus | null;
  de_review_remarks: string | null;
  de_reviewed_by: string | null;
  de_reviewed_at: string | null;
  completeness: GovernanceCompleteness;
};

export type DeReviewDecision = "Approve" | "Return";

export function useDeApprovalQueue(periodId: string | null) {
  return useQuery({
    queryKey: ["de-approval-queue", periodId],
    queryFn: () =>
      api.get<DeApprovalQueueResponse>(
        periodId ? `/de-approval/queue?period_id=${periodId}` : "/de-approval/queue",
      ),
  });
}

export function useDeReviewDetail(projectId: string | null) {
  return useQuery({
    queryKey: ["de-approval-detail", projectId],
    queryFn: () => api.get<DeReviewDetail>(`/de-approval/${projectId}`),
    enabled: !!projectId,
  });
}

export function useUpdateModuleReview(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      moduleKey,
      reviewAction,
    }: {
      moduleKey: GovernanceModuleKey;
      reviewAction: DeModuleReviewAction;
    }) =>
      api.put<GovernanceModuleStatus>(`/de-approval/${projectId}/modules/${moduleKey}`, {
        review_action: reviewAction,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-approval-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["de-approval-queue"] });
    },
  });
}

export function useDeReviewDecision(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { decision: DeReviewDecision; remarks: string; reviewed_by: string }) =>
      api.patch<DeReviewDetail>(`/de-approval/${projectId}/decision`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-approval-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["de-approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
    },
  });
}
