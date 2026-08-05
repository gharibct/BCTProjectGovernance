import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

export type HealthRating = "Red" | "Potential Red" | "Amber" | "Green";

export type HealthDeclaration = {
  id: string;
  project_id: string;
  declaration_date: string;
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
  declaration_date: string;
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

// Append-only history — no update/delete (see backend/app/api/v1/endpoints/
// health_declarations.py). "Latest" 404s until the first one is created,
// which is a normal state (not an error), so it's swallowed to undefined.
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

export function useCreateHealthDeclaration(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: HealthDeclarationPayload) =>
      api.post<HealthDeclaration>(`/projects/${projectId}/health-declarations`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-declaration-latest", projectId] });
      // Creating a declaration updates the Project's cached health fields
      // server-side (delivery_declared_overall_health / overall_project_health).
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
