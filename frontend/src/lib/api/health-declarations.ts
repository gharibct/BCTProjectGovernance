import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

export type HealthRating = "Red" | "Potential Red" | "Amber" | "Green";

export type HealthDeclaration = {
  id: string;
  project_id: string;
  period_id: string;
  core_delivery_rating: HealthRating;
  core_delivery_description: string | null;
  people_rating: HealthRating;
  people_description: string | null;
  operational_rating: HealthRating;
  operational_description: string | null;
  customer_rating: HealthRating;
  customer_description: string | null;
  financial_rating: HealthRating;
  financial_description: string | null;
  compliance_rating: HealthRating;
  compliance_description: string | null;
  overall_rating: HealthRating;
  declared_by: string | null;
  created_at: string;
};

export type HealthDeclarationPayload = {
  period_id: string;
  core_delivery_rating: HealthRating;
  core_delivery_description?: string;
  people_rating: HealthRating;
  people_description?: string;
  operational_rating: HealthRating;
  operational_description?: string;
  customer_rating: HealthRating;
  customer_description?: string;
  financial_rating: HealthRating;
  financial_description?: string;
  compliance_rating: HealthRating;
  compliance_description?: string;
};

export type HealthDeclarationUpdatePayload = Omit<HealthDeclarationPayload, "period_id">;

// One declaration per reporting period (see
// backend/app/api/v1/endpoints/health_declarations.py) — "latest" 404s until
// the first one is created, which is a normal state (not an error), so it's
// swallowed to undefined.
export function useLatestHealthDeclaration(projectId: string | null) {
  return useQuery({
    queryKey: ["health-declaration-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<HealthDeclaration>(`/projects/${projectId}/health-declarations/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

// Full history for a project — used to look up whether a declaration already
// exists for a given period (so the form can PUT instead of re-POSTing into
// the project_id+period_id unique constraint), same pattern as
// useStatusReports in project-status.ts.
export function useHealthDeclarations(projectId: string | null) {
  return useQuery({
    queryKey: ["health-declarations", projectId],
    queryFn: () => api.get<HealthDeclaration[]>(`/projects/${projectId}/health-declarations`),
    enabled: !!projectId,
  });
}

function invalidateHealthDeclarations(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["health-declaration-latest", projectId] });
  queryClient.invalidateQueries({ queryKey: ["health-declarations", projectId] });
  // Creating/updating a declaration updates the Project's cached health
  // fields server-side (delivery_declared_overall_health / overall_project_health).
  queryClient.invalidateQueries({ queryKey: ["project", projectId] });
}

export function useCreateHealthDeclaration(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: HealthDeclarationPayload) =>
      api.post<HealthDeclaration>(`/projects/${projectId}/health-declarations`, payload),
    onSuccess: () => invalidateHealthDeclarations(queryClient, projectId),
  });
}

export function useUpdateHealthDeclaration(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: HealthDeclarationUpdatePayload }) =>
      api.put<HealthDeclaration>(`/projects/${projectId}/health-declarations/${id}`, payload),
    onSuccess: () => invalidateHealthDeclarations(queryClient, projectId),
  });
}

// --- RAG Status grids (redesign of the *_description fields above, one
// per category, into per-category add/edit/delete registers — see
// backend/app/api/v1/endpoints/health_declarations.py's items_router) ---

export type HealthCategory = "Core Delivery" | "People" | "Operational" | "Customer" | "Financial" | "Compliance";

export type HealthItem = {
  id: string;
  project_id: string;
  period_id: string;
  category: HealthCategory;
  description: string;
  account_rollup_status: "Pending" | "Pulled" | "Ignored";
  rolled_up_account_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthItemPayload = {
  period_id: string;
  category: HealthCategory;
  description: string;
};

export type HealthItemUpdatePayload = { description: string };

function healthItemsQuery(projectId: string, periodId: string, category: HealthCategory): string {
  return `/projects/${projectId}/health-items?period_id=${periodId}&category=${encodeURIComponent(category)}`;
}

export function useHealthItems(projectId: string | null, periodId: string | null, category: HealthCategory) {
  return useQuery({
    queryKey: ["health-items", projectId, periodId, category],
    queryFn: () => api.get<HealthItem[]>(healthItemsQuery(projectId!, periodId!, category)),
    enabled: !!projectId && !!periodId,
  });
}

function invalidateHealthItems(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | null,
  periodId: string | null,
  category: HealthCategory
) {
  queryClient.invalidateQueries({ queryKey: ["health-items", projectId, periodId, category] });
}

export function useCreateHealthItem(projectId: string | null, periodId: string | null, category: HealthCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: HealthItemPayload) => api.post<HealthItem>(`/projects/${projectId}/health-items`, payload),
    onSuccess: () => invalidateHealthItems(queryClient, projectId, periodId, category),
  });
}

export function useUpdateHealthItem(projectId: string | null, periodId: string | null, category: HealthCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: HealthItemUpdatePayload }) =>
      api.put<HealthItem>(`/projects/${projectId}/health-items/${id}`, payload),
    onSuccess: () => invalidateHealthItems(queryClient, projectId, periodId, category),
  });
}

export function useDeleteHealthItem(projectId: string | null, periodId: string | null, category: HealthCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/health-items/${id}`),
    onSuccess: () => invalidateHealthItems(queryClient, projectId, periodId, category),
  });
}
