import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";
import type { ProjectStatusCategory, ReportStatus } from "./project-status";

// Account Reporting / Geo Reporting — manually authored, period-scoped
// narrative reports (see backend/app/api/v1/endpoints/regional_status.py).
// Same shape as project-status.ts's Project Status hooks, generated once
// here and parameterized by scope ("account" | "geo") instead of duplicated,
// since the two are structurally identical — only the owning entity differs.

export type RegionalScope = "account" | "geo";

export type RegionalStatusReport = {
  id: string;
  account_id?: string;
  geo_id?: string;
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

export type RegionalStatusReportPayload = {
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

export type RegionalStatusReportUpdatePayload = Partial<Omit<RegionalStatusReportPayload, "period_id">>;

function basePath(scope: RegionalScope, scopeId: string): string {
  return `/${scope}s/${scopeId}/status-reports`;
}

// One report per reporting period — "latest" 404s until the first one is
// created, which is normal, not an error, so it's swallowed to undefined.
export function useLatestRegionalStatusReport(scope: RegionalScope, scopeId: string | null) {
  return useQuery({
    queryKey: ["regional-status-report-latest", scope, scopeId],
    queryFn: async () => {
      try {
        return await api.get<RegionalStatusReport>(`${basePath(scope, scopeId!)}/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!scopeId,
  });
}

// Full history — used both to look up whether a report already exists for a
// given period (so the form can PUT instead of re-POSTing into the
// scope_id+period_id unique constraint) and to render the hub's history table.
export function useRegionalStatusReports(scope: RegionalScope, scopeId: string | null) {
  return useQuery({
    queryKey: ["regional-status-reports", scope, scopeId],
    queryFn: () => api.get<RegionalStatusReport[]>(basePath(scope, scopeId!)),
    enabled: !!scopeId,
  });
}

function invalidateRegionalStatusReports(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: RegionalScope,
  scopeId: string | null
) {
  queryClient.invalidateQueries({ queryKey: ["regional-status-report-latest", scope, scopeId] });
  queryClient.invalidateQueries({ queryKey: ["regional-status-reports", scope, scopeId] });
}

export function useCreateRegionalStatusReport(scope: RegionalScope, scopeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegionalStatusReportPayload) =>
      api.post<RegionalStatusReport>(basePath(scope, scopeId!), payload),
    onSuccess: () => invalidateRegionalStatusReports(queryClient, scope, scopeId),
  });
}

export function useUpdateRegionalStatusReport(scope: RegionalScope, scopeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RegionalStatusReportUpdatePayload }) =>
      api.put<RegionalStatusReport>(`${basePath(scope, scopeId!)}/${id}`, payload),
    onSuccess: () => invalidateRegionalStatusReports(queryClient, scope, scopeId),
  });
}

// Account Review / Geo Review (for Geo Heads / CXO): approve/reject a
// Submitted report.
export type StatusReportReviewPayload = {
  decision: "Approved" | "Rejected";
  comment?: string;
  reviewed_by?: string;
};

export function useReviewRegionalStatusReport(scope: RegionalScope, scopeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StatusReportReviewPayload }) =>
      api.patch<RegionalStatusReport>(`${basePath(scope, scopeId!)}/${id}/review`, payload),
    onSuccess: () => invalidateRegionalStatusReports(queryClient, scope, scopeId),
  });
}

// --- Account/Geo Status grids (redesign of the 3 free-text sections above,
// plus a new 4th "Key Risks / Issues" section, into per-category
// add/edit/delete registers — mirrors lib/api/project-status.ts's item
// hooks, generalized by scope) ---

export type RegionalStatusItem = {
  id: string;
  account_id?: string;
  geo_id?: string;
  period_id: string;
  category: ProjectStatusCategory;
  description: string;
  created_at: string;
  updated_at: string;
};

export type RegionalStatusItemPayload = {
  period_id: string;
  category: ProjectStatusCategory;
  description: string;
};

export type RegionalStatusItemUpdatePayload = { description: string };

function itemsQuery(
  scope: RegionalScope,
  scopeId: string,
  periodId: string,
  category: ProjectStatusCategory
): string {
  return `/${scope}s/${scopeId}/status-items?period_id=${periodId}&category=${encodeURIComponent(category)}`;
}

export function useRegionalStatusItems(
  scope: RegionalScope,
  scopeId: string | null,
  periodId: string | null,
  category: ProjectStatusCategory
) {
  return useQuery({
    queryKey: ["regional-status-items", scope, scopeId, periodId, category],
    queryFn: () => api.get<RegionalStatusItem[]>(itemsQuery(scope, scopeId!, periodId!, category)),
    enabled: !!scopeId && !!periodId,
  });
}

function invalidateRegionalStatusItems(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: RegionalScope,
  scopeId: string | null,
  periodId: string | null,
  category: ProjectStatusCategory
) {
  queryClient.invalidateQueries({ queryKey: ["regional-status-items", scope, scopeId, periodId, category] });
}

export function useCreateRegionalStatusItem(
  scope: RegionalScope,
  scopeId: string | null,
  periodId: string | null,
  category: ProjectStatusCategory
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegionalStatusItemPayload) =>
      api.post<RegionalStatusItem>(`/${scope}s/${scopeId}/status-items`, payload),
    onSuccess: () => invalidateRegionalStatusItems(queryClient, scope, scopeId, periodId, category),
  });
}

export function useUpdateRegionalStatusItem(
  scope: RegionalScope,
  scopeId: string | null,
  periodId: string | null,
  category: ProjectStatusCategory
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RegionalStatusItemUpdatePayload }) =>
      api.put<RegionalStatusItem>(`/${scope}s/${scopeId}/status-items/${id}`, payload),
    onSuccess: () => invalidateRegionalStatusItems(queryClient, scope, scopeId, periodId, category),
  });
}

export function useDeleteRegionalStatusItem(
  scope: RegionalScope,
  scopeId: string | null,
  periodId: string | null,
  category: ProjectStatusCategory
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/${scope}s/${scopeId}/status-items/${id}`),
    onSuccess: () => invalidateRegionalStatusItems(queryClient, scope, scopeId, periodId, category),
  });
}
