import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { Project, ProjectStatus } from "./projects";

// Maintain Project — "Send To Approval" screen. The PM-facing mirror of the DE
// governance completeness check: the modules a Project Manager must finish
// before a Draft project can be submitted for DE approval. Project Profile,
// Scope & Schedule, Measurement, Commitments and Milestones are mandatory;
// RAIDO is informational and never blocks. Backed by
// GET/POST /api/v1/projects/{id}/(approval-readiness|send-to-approval).

export type ApprovalReadinessModuleKey =
  | "project_profile"
  | "scope_schedule"
  | "measurement"
  | "commitments"
  | "milestones"
  | "raido";

export type ApprovalReadinessModule = {
  key: ApprovalReadinessModuleKey;
  label: string;
  mandatory: boolean;
  complete: boolean;
  gaps: string | null;
  last_updated: string | null;
  // Partial progress: required fields filled / required fields expected.
  fields_complete: number;
  fields_total: number;
  progress_pct: number;
};

export type ApprovalReadiness = {
  completion_pct: number;
  modules_complete: number;
  modules_incomplete: number;
  gaps_count: number;
  critical_gaps: number;
  modules: ApprovalReadinessModule[];
  project_status: ProjectStatus;
  can_submit: boolean;
};

// Shape of the 422 body from POST /send-to-approval when validation fails.
export type SendToApprovalError = {
  message: string;
  readiness: ApprovalReadiness;
};

// Where each checklist row's "View" link goes, relative to
// /new-project/{projectId} (the Maintain Project route tree). Commitments and
// Milestones are both edited on the one Contractual Compliance screen.
export const APPROVAL_MODULE_VIEW_PATH: Record<ApprovalReadinessModuleKey, string> = {
  project_profile: "project-charter",
  scope_schedule: "project-charter/schedule",
  measurement: "measurement",
  commitments: "contractual-compliance",
  milestones: "contractual-compliance",
  raido: "raido",
};

export function useApprovalReadiness(projectId: string | null) {
  return useQuery({
    queryKey: ["approval-readiness", projectId],
    queryFn: () => api.get<ApprovalReadiness>(`/projects/${projectId}/approval-readiness`),
    enabled: !!projectId,
    // Readiness is derived entirely from other server state (profile,
    // measurement targets, commitments, milestones) edited on sibling screens
    // that don't know to invalidate this key. Keep nothing between visits and
    // always refetch on mount so the checklist reflects the latest saves.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}

function invalidateAfterStatusChange(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  queryClient.invalidateQueries({ queryKey: ["projects"] });
  queryClient.invalidateQueries({ queryKey: ["approval-readiness", projectId] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
}

export function useSendToApproval(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Project>(`/projects/${projectId}/send-to-approval`),
    // onSettled (not onSuccess) so the checklist also re-fetches after the 422
    // path, where the server has just recomputed readiness.
    onSettled: () => invalidateAfterStatusChange(queryClient, projectId),
  });
}

// PM pulls the project back out of the DE approval queue to edit it again —
// Pending Approval -> Draft (or -> Under Amendment when it came from an
// amendment). Server rejects (422) unless it is still Pending Approval.
export function useRecallApproval(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Project>(`/projects/${projectId}/recall-approval`),
    onSettled: () => invalidateAfterStatusChange(queryClient, projectId),
  });
}

// Amend Project — start an amendment on an already-approved project: snapshots
// the current project data and moves it to "Under Amendment". Server rejects
// (422) unless status is Approved / Hold / Open Only for Billing.
export function useInitiateAmendment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Project>(`/projects/${projectId}/initiate-amendment`),
    onSettled: () => invalidateAfterStatusChange(queryClient, projectId),
  });
}
