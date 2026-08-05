import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";
import type { HealthRating } from "./health-declarations";

export type FindingClassification = "Observation" | "Recommendation";
export type FindingStatus = "Open" | "Closed" | "On Hold" | "Deferred";

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
  action_taken: string | null;
  finding_date: string | null;
  status: FindingStatus;
  remarks: string | null;
};

export type DEAssessment = {
  id: string;
  project_id: string;
  assessment_date: string;
  de_assessed_project_health: HealthRating;
  pci_score: string | null;
  next_assessment_due_date: string | null;
  assessed_by: string | null;
  created_at: string;
  updated_at: string;
  alerts: DEAssessmentAlert[];
  findings: DEAssessmentFinding[];
};

// Header only — Alerts and Findings are added afterward, one at a time, via
// their own registers (useCreateDEAssessmentAlert/useCreateDEAssessmentFinding).
export type DEAssessmentPayload = {
  assessment_date: string;
  de_assessed_project_health: HealthRating;
  pci_score?: string;
};

export type DEAssessmentAlertPayload = {
  alert_category?: string;
  brief_description: string;
  detailed_description?: string;
  raised_on?: string;
};

export type DEAssessmentFindingPayload = {
  sequence_no: number;
  classification: FindingClassification;
  action_taken?: string;
  finding_date?: string;
  status?: FindingStatus;
  remarks?: string;
};

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
      // Creating an assessment updates the Project's cached health fields
      // server-side (de_assessed_project_health / overall_project_health).
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
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
