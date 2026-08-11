import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

export type ReportStatus = "Draft" | "Submitted";

export type ProjectStatusReport = {
  id: string;
  project_id: string;
  period_id: string;
  status: ReportStatus;
  key_accomplishments: string | null;
  upcoming_key_releases: string | null;
  leadership_support_required: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectStatusReportPayload = {
  period_id: string;
  status?: ReportStatus;
  key_accomplishments?: string;
  upcoming_key_releases?: string;
  leadership_support_required?: string;
};

export type ProjectStatusReportUpdatePayload = Partial<Omit<ProjectStatusReportPayload, "period_id">>;

// One report per reporting period (see
// backend/app/api/v1/endpoints/project_status.py) — "latest" 404s until the
// first one is created, which is normal, not an error, so it's swallowed to
// undefined.
export function useLatestStatusReport(projectId: string | null) {
  return useQuery({
    queryKey: ["status-report-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<ProjectStatusReport>(`/projects/${projectId}/status-reports/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

// Full history for a project — used both to look up whether a report already
// exists for a given period (so the form can PUT instead of re-POSTing into
// the project_id+period_id unique constraint) and to render the Reporting
// Hub's history table.
export function useStatusReports(projectId: string | null) {
  return useQuery({
    queryKey: ["status-reports", projectId],
    queryFn: () => api.get<ProjectStatusReport[]>(`/projects/${projectId}/status-reports`),
    enabled: !!projectId,
  });
}

function invalidateStatusReports(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["status-report-latest", projectId] });
  queryClient.invalidateQueries({ queryKey: ["status-reports", projectId] });
}

export function useCreateStatusReport(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectStatusReportPayload) =>
      api.post<ProjectStatusReport>(`/projects/${projectId}/status-reports`, payload),
    onSuccess: () => invalidateStatusReports(queryClient, projectId),
  });
}

export function useUpdateStatusReport(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectStatusReportUpdatePayload }) =>
      api.put<ProjectStatusReport>(`/projects/${projectId}/status-reports/${id}`, payload),
    onSuccess: () => invalidateStatusReports(queryClient, projectId),
  });
}
