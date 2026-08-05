import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

export type ProjectStatusReport = {
  id: string;
  project_id: string;
  report_date: string;
  key_accomplishments: string | null;
  upcoming_key_releases: string | null;
  leadership_support_required: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectStatusReportPayload = {
  report_date: string;
  key_accomplishments?: string;
  upcoming_key_releases?: string;
  leadership_support_required?: string;
};

// One report per week (see backend/app/api/v1/endpoints/project_status.py) —
// "latest" 404s until the first one is created, which is normal, not an
// error, so it's swallowed to undefined.
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

export function useCreateStatusReport(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectStatusReportPayload) =>
      api.post<ProjectStatusReport>(`/projects/${projectId}/status-reports`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status-report-latest", projectId] });
    },
  });
}
