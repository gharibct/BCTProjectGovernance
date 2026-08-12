import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

export type ReportStatus = "Draft" | "Submitted" | "Approved" | "Rejected";

export type ProjectStatusReport = {
  id: string;
  project_id: string;
  period_id: string;
  status: ReportStatus;
  // Decimal — Pydantic serializes it as a JSON string, not a number, to
  // avoid float precision loss (same convention as projects.ts's project_revenue).
  revenue: string | null;
  onsite_fte: string | null;
  offshore_fte: string | null;
  projects_count: number | null;
  key_accomplishments: string | null;
  upcoming_key_releases: string | null;
  leadership_support_required: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectStatusReportPayload = {
  period_id: string;
  status?: ReportStatus;
  revenue?: string;
  onsite_fte?: string;
  offshore_fte?: string;
  projects_count?: number;
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

// Project Review (for Account Heads): approve/reject a Submitted report.
export type StatusReportReviewPayload = {
  decision: "Approved" | "Rejected";
  comment?: string;
  reviewed_by?: string;
};

export function useReviewStatusReport(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StatusReportReviewPayload }) =>
      api.patch<ProjectStatusReport>(`/projects/${projectId}/status-reports/${id}/review`, payload),
    onSuccess: () => invalidateStatusReports(queryClient, projectId),
  });
}

// --- Project Status grids (redesign of the 3 free-text sections above,
// plus a new 4th "Key Risks / Issues" section, into per-category
// add/edit/delete registers — see backend/app/api/v1/endpoints/project_status.py's
// items_router) ---

export type ProjectStatusCategory =
  | "Key Accomplishments"
  | "Upcoming Key Releases / Milestones / Actions"
  | "Leadership Support / Attention Required"
  | "Key Risks / Issues";

export type ProjectStatusItem = {
  id: string;
  project_id: string;
  period_id: string;
  category: ProjectStatusCategory;
  description: string;
  created_at: string;
  updated_at: string;
};

export type ProjectStatusItemPayload = {
  period_id: string;
  category: ProjectStatusCategory;
  description: string;
};

export type ProjectStatusItemUpdatePayload = { description: string };

function statusItemsQuery(projectId: string, periodId: string, category: ProjectStatusCategory): string {
  return `/projects/${projectId}/status-items?period_id=${periodId}&category=${encodeURIComponent(category)}`;
}

export function useStatusItems(projectId: string | null, periodId: string | null, category: ProjectStatusCategory) {
  return useQuery({
    queryKey: ["status-items", projectId, periodId, category],
    queryFn: () => api.get<ProjectStatusItem[]>(statusItemsQuery(projectId!, periodId!, category)),
    enabled: !!projectId && !!periodId,
  });
}

function invalidateStatusItems(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | null,
  periodId: string | null,
  category: ProjectStatusCategory
) {
  queryClient.invalidateQueries({ queryKey: ["status-items", projectId, periodId, category] });
}

export function useCreateStatusItem(projectId: string | null, periodId: string | null, category: ProjectStatusCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectStatusItemPayload) =>
      api.post<ProjectStatusItem>(`/projects/${projectId}/status-items`, payload),
    onSuccess: () => invalidateStatusItems(queryClient, projectId, periodId, category),
  });
}

export function useUpdateStatusItem(projectId: string | null, periodId: string | null, category: ProjectStatusCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectStatusItemUpdatePayload }) =>
      api.put<ProjectStatusItem>(`/projects/${projectId}/status-items/${id}`, payload),
    onSuccess: () => invalidateStatusItems(queryClient, projectId, periodId, category),
  });
}

export function useDeleteStatusItem(projectId: string | null, periodId: string | null, category: ProjectStatusCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/status-items/${id}`),
    onSuccess: () => invalidateStatusItems(queryClient, projectId, periodId, category),
  });
}
