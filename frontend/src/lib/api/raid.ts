import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "./client";

// All five RAID logs share one CRUD shape under /projects/{project_id}/{prefix}
// (see backend/app/api/v1/endpoints/raid.py's build_raid_router), including
// PUT/DELETE per item — these four generic hooks back every entity below.
function useRaidList<T>(projectId: string | null, prefix: string) {
  return useQuery({
    queryKey: ["raid", prefix, projectId],
    queryFn: () => api.get<Page<T>>(`/projects/${projectId}/${prefix}?limit=200`),
    select: (page) => page.items,
    enabled: !!projectId,
  });
}

function useRaidCreate<TPayload, TRead>(projectId: string | null, prefix: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TPayload) => api.post<TRead>(`/projects/${projectId}/${prefix}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raid", prefix, projectId] });
    },
  });
}

function useRaidUpdate<TPayload, TRead>(projectId: string | null, prefix: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TPayload }) =>
      api.put<TRead>(`/projects/${projectId}/${prefix}/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raid", prefix, projectId] });
    },
  });
}

function useRaidDelete(projectId: string | null, prefix: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/${prefix}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raid", prefix, projectId] });
    },
  });
}

// --- Risk ---

export type RiskLog = {
  id: string;
  risk_code: string;
  project_id: string;
  risk_title: string;
  risk_description: string | null;
  risk_category: string | null;
  risk_type: string | null;
  identified_by: string | null;
  identified_date: string | null;
  risk_owner: string | null;
  trigger_event: string | null;
  probability: string | null;
  impact: string | null;
  risk_score: number | null;
  severity: string | null;
  affected_deliverables: string | null;
  affected_milestone: string | null;
  response_strategy: string | null;
  mitigation_plan: string | null;
  contingency_plan: string | null;
  residual_risk: string | null;
  target_resolution_date: string | null;
  current_status: string;
  escalation_required: boolean;
  escalated_to: string | null;
  last_review_date: string | null;
  next_review_date: string | null;
  remarks: string | null;
};

export type RiskLogPayload = Partial<Omit<RiskLog, "id" | "risk_code" | "project_id" | "current_status">>;

export const useRisks = (projectId: string | null) => useRaidList<RiskLog>(projectId, "risks");
export const useCreateRisk = (projectId: string | null) =>
  useRaidCreate<RiskLogPayload, RiskLog>(projectId, "risks");
export const useUpdateRisk = (projectId: string | null) =>
  useRaidUpdate<RiskLogPayload, RiskLog>(projectId, "risks");
export const useDeleteRisk = (projectId: string | null) => useRaidDelete(projectId, "risks");

// --- Issue ---

export type IssueLog = {
  id: string;
  issue_code: string;
  project_id: string;
  issue_title: string;
  issue_description: string | null;
  issue_category: string | null;
  priority: string | null;
  severity: string | null;
  raised_by: string | null;
  raised_date: string | null;
  assigned_to: string | null;
  root_cause: string | null;
  business_impact: string | null;
  affected_deliverables: string | null;
  affected_milestone: string | null;
  resolution_plan: string | null;
  due_date: string | null;
  actual_resolution_date: string | null;
  status: string;
  escalation_level: string | null;
  escalation_date: string | null;
  resolution_summary: string | null;
  lessons_learned: string | null;
  closure_date: string | null;
  remarks: string | null;
  last_review_date: string | null;
  next_review_date: string | null;
};

export type IssueLogPayload = Partial<Omit<IssueLog, "id" | "issue_code" | "project_id" | "status">>;

export const useIssues = (projectId: string | null) => useRaidList<IssueLog>(projectId, "issues");
export const useCreateIssue = (projectId: string | null) =>
  useRaidCreate<IssueLogPayload, IssueLog>(projectId, "issues");
export const useUpdateIssue = (projectId: string | null) =>
  useRaidUpdate<IssueLogPayload, IssueLog>(projectId, "issues");
export const useDeleteIssue = (projectId: string | null) => useRaidDelete(projectId, "issues");

// --- Dependency ---

export type DependencyLog = {
  id: string;
  dependency_code: string;
  project_id: string;
  dependency_title: string;
  description: string | null;
  dependency_type: string | null;
  category: string | null;
  depends_on: string | null;
  related_task_milestone: string | null;
  required_by_date: string | null;
  owner: string | null;
  dependency_status: string;
  criticality: string | null;
  impact_if_delayed: string | null;
  probability_of_delay: string | null;
  mitigation_plan: string | null;
  escalation_required: boolean;
  escalation_level: string | null;
  actual_completion_date: string | null;
  last_updated: string | null;
  remarks: string | null;
  last_review_date: string | null;
  next_review_date: string | null;
};

export type DependencyLogPayload = Partial<
  Omit<DependencyLog, "id" | "dependency_code" | "project_id" | "dependency_status">
>;

export const useDependencies = (projectId: string | null) => useRaidList<DependencyLog>(projectId, "dependencies");
export const useCreateDependency = (projectId: string | null) =>
  useRaidCreate<DependencyLogPayload, DependencyLog>(projectId, "dependencies");
export const useUpdateDependency = (projectId: string | null) =>
  useRaidUpdate<DependencyLogPayload, DependencyLog>(projectId, "dependencies");
export const useDeleteDependency = (projectId: string | null) => useRaidDelete(projectId, "dependencies");

// --- Assumption ---

export type AssumptionLog = {
  id: string;
  assumption_code: string;
  project_id: string;
  title: string;
  detailed_description: string | null;
  category: string | null;
  raised_by: string | null;
  raised_date: string | null;
  owner: string | null;
  dependency_reference: string | null;
  impact_if_invalid: string | null;
  probability_of_failure: string | null;
  impact_rating: string | null;
  validation_date: string | null;
  validation_status: string;
  mitigation_plan: string | null;
  contingency_plan: string | null;
  current_status: string;
  last_updated: string | null;
  remarks: string | null;
};

export type AssumptionLogPayload = Partial<
  Omit<AssumptionLog, "id" | "assumption_code" | "project_id" | "validation_status" | "current_status">
>;

export const useAssumptions = (projectId: string | null) => useRaidList<AssumptionLog>(projectId, "assumptions");
export const useCreateAssumption = (projectId: string | null) =>
  useRaidCreate<AssumptionLogPayload, AssumptionLog>(projectId, "assumptions");
export const useUpdateAssumption = (projectId: string | null) =>
  useRaidUpdate<AssumptionLogPayload, AssumptionLog>(projectId, "assumptions");
export const useDeleteAssumption = (projectId: string | null) => useRaidDelete(projectId, "assumptions");

// --- Opportunity ---

export type OpportunityLog = {
  id: string;
  opportunity_code: string;
  project_id: string;
  opportunity_title: string;
  opportunity_description: string | null;
  category: string | null;
  identified_by: string | null;
  identified_date: string | null;
  opportunity_owner: string | null;
  impact: string | null;
  expected_benefit: string | null;
  estimated_benefit: string | null;
  benefit_type: string | null;
  exploitation_strategy: string | null;
  action_plan: string | null;
  target_implementation_date: string | null;
  status: string;
  approval_required: boolean;
  approved_by: string | null;
  actual_benefit: string | null;
  closure_date: string | null;
  remarks: string | null;
  last_review_date: string | null;
  next_review_date: string | null;
};

export type OpportunityLogPayload = Partial<
  Omit<OpportunityLog, "id" | "opportunity_code" | "project_id" | "status">
>;

export const useOpportunities = (projectId: string | null) => useRaidList<OpportunityLog>(projectId, "opportunities");
export const useCreateOpportunity = (projectId: string | null) =>
  useRaidCreate<OpportunityLogPayload, OpportunityLog>(projectId, "opportunities");
export const useUpdateOpportunity = (projectId: string | null) =>
  useRaidUpdate<OpportunityLogPayload, OpportunityLog>(projectId, "opportunities");
export const useDeleteOpportunity = (projectId: string | null) => useRaidDelete(projectId, "opportunities");
