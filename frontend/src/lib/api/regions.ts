import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { Region } from "./reference-data";

export type RegionPayload = {
  geo_id: string;
  code: string;
  name: string;
  is_active?: boolean;
};

export function useCreateRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegionPayload) => api.post<Region>("/regions", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
  });
}

export function useUpdateRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RegionPayload }) =>
      api.put<Region>(`/regions/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
  });
}

export function useDeleteRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/regions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
  });
}
