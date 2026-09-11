import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { Account } from "./reference-data";

export type AccountPayload = {
  name: string;
  geo_id?: string;
  region_id?: string;
  description?: string;
  is_active?: boolean;
  tool_effective_date?: string;
};

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountPayload) => api.post<Account>("/accounts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AccountPayload }) =>
      api.put<Account>(`/accounts/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
