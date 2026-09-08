import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { Geo } from "./reference-data";

export type GeoPayload = {
  code: string;
  name: string;
  is_active?: boolean;
  tool_effective_date?: string;
};

export function useCreateGeo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GeoPayload) => api.post<Geo>("/geos", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geos"] });
    },
  });
}

export function useUpdateGeo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GeoPayload }) =>
      api.put<Geo>(`/geos/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geos"] });
    },
  });
}

export function useDeleteGeo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/geos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geos"] });
    },
  });
}
