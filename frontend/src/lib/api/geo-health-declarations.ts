import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

// Geo RAG Status — geo-level equivalent of account-health-declarations.ts,
// deliberately its own file (not folded into the generic regional-status.ts
// scope="account"|"geo" scaffolding) since this feature is geo-only.
export type HealthRating = "Red" | "Potential Red" | "Amber" | "Green";

export type GeoHealthDeclaration = {
  id: string;
  geo_id: string;
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

export type GeoHealthDeclarationPayload = {
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

export type GeoHealthDeclarationUpdatePayload = Omit<GeoHealthDeclarationPayload, "period_id">;

// One declaration per reporting period — "latest" 404s until the first one
// is created, which is a normal state (not an error), so it's swallowed to
// undefined.
export function useLatestGeoHealthDeclaration(geoId: string | null) {
  return useQuery({
    queryKey: ["geo-health-declaration-latest", geoId],
    queryFn: async () => {
      try {
        return await api.get<GeoHealthDeclaration>(`/geos/${geoId}/health-declarations/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!geoId,
  });
}

// Full history for a geo — used to look up whether a declaration already
// exists for a given period (so the form can PUT instead of re-POSTing into
// the geo_id+period_id unique constraint).
export function useGeoHealthDeclarations(geoId: string | null) {
  return useQuery({
    queryKey: ["geo-health-declarations", geoId],
    queryFn: () => api.get<GeoHealthDeclaration[]>(`/geos/${geoId}/health-declarations`),
    enabled: !!geoId,
  });
}

function invalidateGeoHealthDeclarations(queryClient: ReturnType<typeof useQueryClient>, geoId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["geo-health-declaration-latest", geoId] });
  queryClient.invalidateQueries({ queryKey: ["geo-health-declarations", geoId] });
}

export function useCreateGeoHealthDeclaration(geoId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GeoHealthDeclarationPayload) =>
      api.post<GeoHealthDeclaration>(`/geos/${geoId}/health-declarations`, payload),
    onSuccess: () => invalidateGeoHealthDeclarations(queryClient, geoId),
  });
}

export function useUpdateGeoHealthDeclaration(geoId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GeoHealthDeclarationUpdatePayload }) =>
      api.put<GeoHealthDeclaration>(`/geos/${geoId}/health-declarations/${id}`, payload),
    onSuccess: () => invalidateGeoHealthDeclarations(queryClient, geoId),
  });
}
