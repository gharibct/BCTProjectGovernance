import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";
import type { HealthRating } from "./health-declarations";

// Observation/Recommendation are the legacy register-tab values; the DE
// Assessment Workspace uses Governance/Performance/Security/Financial.
export type FindingClassification =
  | "Observation"
  | "Recommendation"
  | "Governance"
  | "Performance"
  | "Security"
  | "Financial";
// Lifecycle mirrors the Action Tracker; On Hold/Deferred stay valid for legacy rows.
export type FindingStatus =
  | "Open"
  | "In Progress"
  | "Awaiting Closure"
  | "Closed"
  | "Cancelled"
  | "On Hold"
  | "Deferred";
export type FindingSeverity = "Low" | "Medium" | "High" | "Critical";
export type DEAssessmentStatus = "Draft" | "Submitted";

export const FINDING_CLASSIFICATION_OPTIONS: FindingClassification[] = [
  "Governance",
  "Performance",
  "Security",
  "Financial",
];
export const FINDING_SEVERITY_OPTIONS: FindingSeverity[] = ["Low", "Medium", "High", "Critical"];

export type DEAssessmentAlert = {
  id: string;
  alert_code: string;
  assessment_id: string;
  alert_category: string | null;
  brief_description: string;
  detailed_description: string | null;
  raised_by: string | null;
  raised_on: string;
  created_at: string;
};

export type DEAssessmentFinding = {
  id: string;
  assessment_id: string;
  sequence_no: number;
  classification: FindingClassification;
  description: string | null;
  severity: FindingSeverity | null;
  assigned_to: string | null;
  action_taken: string | null;
  finding_date: string | null;
  due_date: string | null;
  status: FindingStatus;
  remarks: string | null;
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
  alerts: DEAssessmentAlert[];
  findings: DEAssessmentFinding[];
};

// Header only — Alerts and Findings are added afterward, one at a time, via
// their own registers (useCreateDEAssessmentAlert/useCreateDEAssessmentFinding).
// status defaults to "Submitted" server-side; the Workspace passes "Draft" for
// Save Draft.
export type DEAssessmentPayload = {
  assessment_date?: string;
  de_assessed_project_health: HealthRating;
  pci_score?: string;
  remarks?: string;
  status?: DEAssessmentStatus;
};

export type DEAssessmentUpdatePayload = {
  de_assessed_project_health?: HealthRating;
  pci_score?: string;
  remarks?: string;
  status?: DEAssessmentStatus;
};

export type DEAssessmentAlertPayload = {
  alert_category?: string;
  brief_description: string;
  detailed_description?: string;
  raised_on?: string;
};

export type DEAssessmentFindingPayload = {
  sequence_no?: number;
  classification: FindingClassification;
  description?: string;
  severity?: FindingSeverity;
  assigned_to?: string;
  action_taken?: string;
  finding_date?: string;
  due_date?: string;
  status?: FindingStatus;
  remarks?: string;
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

export function useCreateDEAssessmentAlert(projectId: string | null, assessmentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DEAssessmentAlertPayload) =>
      api.post<DEAssessmentAlert>(`/projects/${projectId}/de-assessments/${assessmentId}/alerts`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-assessment-latest", projectId] });
    },
  });
}

export function useCreateDEAssessmentFinding(projectId: string | null, assessmentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DEAssessmentFindingPayload) =>
      api.post<DEAssessmentFinding>(`/projects/${projectId}/de-assessments/${assessmentId}/findings`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-assessment-latest", projectId] });
    },
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
export function useUpdateDEAssessmentFinding(projectId: string | null, assessmentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DEAssessmentFindingPayload }) =>
      api.put<DEAssessmentFinding>(
        `/projects/${projectId}/de-assessments/${assessmentId}/findings/${id}`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["de-assessment-latest", projectId] });
    },
  });
}
