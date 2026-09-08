import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";
import type { HealthRating } from "./health-declarations";

// What kind of finding it is. The finding's subject area is a separate
// `category` field (the Project RAG 6-category taxonomy).
export type FindingClassification = "Observation" | "Recommendation" | "Alert";
// The Project RAG 6-category taxonomy (see project-charter/health-declaration.tsx's CATEGORIES).
export type FindingCategory =
  | "Core Delivery"
  | "People"
  | "Operational"
  | "Customer"
  | "Financial"
  | "Compliance";
// Lifecycle mirrors the Action Tracker; On Hold/Deferred stay valid for legacy rows.
export type FindingStatus =
  | "Open"
  | "In Progress"
  | "Awaiting Closure"
  | "Closed"
  | "Cancelled"
  | "On Hold"
  | "Deferred";
export type DEAssessmentStatus = "Draft" | "Submitted";

export const FINDING_CLASSIFICATION_OPTIONS: FindingClassification[] = [
  "Observation",
  "Recommendation",
  "Alert",
];
export const FINDING_CATEGORY_OPTIONS: FindingCategory[] = [
  "Core Delivery",
  "People",
  "Operational",
  "Customer",
  "Financial",
  "Compliance",
];
// Current lifecycle values for a status picker — legacy On Hold/Deferred are
// omitted (still accepted on read for historical rows).
export const FINDING_STATUS_OPTIONS: FindingStatus[] = [
  "Open",
  "In Progress",
  "Awaiting Closure",
  "Closed",
  "Cancelled",
];

export type DEAssessmentFinding = {
  id: string;
  project_id: string;
  sequence_no: number;
  // Lenient string — legacy rows may hold a value outside the current taxonomy.
  category: string;
  classification: FindingClassification;
  description: string | null;
  assigned_to: string | null;
  action_taken: string | null;
  action_taken_date: string | null;
  finding_date: string | null;
  due_date: string | null;
  status: FindingStatus;
  remarks: string | null;
  closure_date: string | null;
  overdue: boolean;
};

export type DEAssessment = {
  id: string;
  project_id: string;
  assessment_date: string | null;
  de_assessed_project_health: HealthRating;
  pci_score: string | null;
  remarks: string | null;
  status: DEAssessmentStatus;
  next_assessment_due_date: string | null;
  assessed_by: string | null;
  created_at: string;
  updated_at: string;
};

// Header only — Findings are added afterward, one at a time, via their own
// register (useCreateDEAssessmentFinding). assessed_by is always set from the
// session server-side. status defaults to "Submitted"; the Workspace passes
// "Draft" for Save Draft.
export type DEAssessmentPayload = {
  assessment_date?: string;
  de_assessed_project_health: HealthRating;
  pci_score?: string;
  remarks?: string;
  status?: DEAssessmentStatus;
};

export type DEAssessmentUpdatePayload = {
  assessment_date?: string;
  de_assessed_project_health?: HealthRating;
  pci_score?: string;
  remarks?: string;
  status?: DEAssessmentStatus;
};

export type DEAssessmentFindingPayload = {
  sequence_no?: number;
  // Required by the create endpoint; omitted for status-only transitions.
  category?: FindingCategory;
  classification?: FindingClassification;
  description?: string;
  assigned_to?: string;
  action_taken?: string;
  action_taken_date?: string;
  finding_date?: string;
  due_date?: string;
  status?: FindingStatus;
  remarks?: string;
  closure_date?: string;
};

// Full assessment history for a project (newest first), header-only rows.
// Used by the DE Assessment Workspace to tell "this period's draft" from the
// prior submitted assessment shown as context.
export function useDEAssessments(projectId: string | null) {
  return useQuery({
    queryKey: ["de-assessments", projectId],
    queryFn: () => api.get<DEAssessment[]>(`/projects/${projectId}/de-assessments`),
    enabled: !!projectId,
  });
}

// Append-only history (list + latest + create only) — same pattern as
// health declarations and status reports.
export function useLatestDEAssessment(projectId: string | null) {
  return useQuery({
    queryKey: ["de-assessment-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<DEAssessment>(`/projects/${projectId}/de-assessments/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

export function useCreateDEAssessment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DEAssessmentPayload) =>
      api.post<DEAssessment>(`/projects/${projectId}/de-assessments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-assessment-latest", projectId] });
      queryClient.invalidateQueries({ queryKey: ["de-assessments", projectId] });
      // Creating an assessment updates the Project's cached health fields
      // server-side (de_assessed_project_health / overall_project_health).
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
    },
  });
}

// Findings are a project-level register (see backend
// db/tables/19_de_assessments.sql) — no longer nested under an assessment, and
// creatable whether or not the project has ever had a DE assessment.
export function useDEAssessmentFindings(projectId: string | null) {
  return useQuery({
    queryKey: ["de-assessment-findings", projectId],
    queryFn: () => api.get<DEAssessmentFinding[]>(`/projects/${projectId}/de-assessment-findings`),
    enabled: !!projectId,
  });
}

function invalidateFindings(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["de-assessment-findings", projectId] });
  // The finding drawer's "Progress & History" timeline.
  queryClient.invalidateQueries({ queryKey: ["de-finding-history"] });
  // Dashboards surface open/overdue finding counts.
  queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
}

// --- Finding history (append-only audit trail) ---

export type FindingHistoryEventType = "CREATED" | "STATUS_CHANGE" | "ACTION_TAKEN";

export type FindingHistoryEntry = {
  id: string;
  finding_id: string;
  event_type: FindingHistoryEventType;
  comment: string | null;
  old_value: string | null;
  new_value: string | null;
  created_by: string;
  created_at: string;
};

// One append-only row per creation, status move, or PM "Action Taken" on a
// finding. The project-scoped read endpoint serves every finding surface
// (DE Findings screen, DE Assessment Workspace) since each carries project_id.
export function useDEFindingHistory(projectId: string | null, findingId: string | null) {
  return useQuery({
    queryKey: ["de-finding-history", projectId, findingId],
    queryFn: () =>
      api.get<FindingHistoryEntry[]>(
        `/projects/${projectId}/de-assessment-findings/${findingId}/history`,
      ),
    enabled: !!projectId && !!findingId,
  });
}

export function useCreateDEAssessmentFinding(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DEAssessmentFindingPayload) =>
      api.post<DEAssessmentFinding>(`/projects/${projectId}/de-assessment-findings`, payload),
    onSuccess: () => invalidateFindings(queryClient, projectId),
  });
}

// Editing a Draft assessment (DE Assessment Workspace "Save Draft" after the
// first save, and "Submit Assessment"). PATCH is rejected once Submitted.
export function useUpdateDEAssessment(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DEAssessmentUpdatePayload }) =>
      api.patch<DEAssessment>(`/projects/${projectId}/de-assessments/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-assessment-latest", projectId] });
      queryClient.invalidateQueries({ queryKey: ["de-assessments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
    },
  });
}

// Finding edits AND status transitions (Start / Awaiting Closure / Close /
// Cancel) both go through this single PUT — the drawer just varies which
// fields it sends.
export function useUpdateDEAssessmentFinding(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DEAssessmentFindingPayload }) =>
      api.put<DEAssessmentFinding>(`/projects/${projectId}/de-assessment-findings/${id}`, payload),
    onSuccess: () => invalidateFindings(queryClient, projectId),
  });
}
