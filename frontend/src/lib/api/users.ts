import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { User } from "./reference-data";

export type UserPayload = {
  ldap_username: string;
  full_name: string;
  email: string;
  role_id: string;
  is_active?: boolean;
};

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserPayload) => api.post<User>("/users", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserPayload }) =>
      api.put<User>(`/users/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// Current scope, fetched on demand when starting an edit (the user list
// itself doesn't carry account_ids/geo_ids — see useUsers in reference-data.ts).
export function useUserAccounts(userId: string | null) {
  return useQuery({
    queryKey: ["user-accounts", userId],
    queryFn: () => api.get<string[]>(`/users/${userId}/accounts`),
    enabled: !!userId,
  });
}

export function useUserGeos(userId: string | null) {
  return useQuery({
    queryKey: ["user-geos", userId],
    queryFn: () => api.get<string[]>(`/users/${userId}/geos`),
    enabled: !!userId,
  });
}

export function useSetUserAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accountIds }: { userId: string; accountIds: string[] }) =>
      api.put<string[]>(`/users/${userId}/accounts`, { account_ids: accountIds }),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-accounts", userId] });
    },
  });
}

export function useSetUserGeos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, geoIds }: { userId: string; geoIds: string[] }) =>
      api.put<string[]>(`/users/${userId}/geos`, { geo_ids: geoIds }),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-geos", userId] });
    },
  });
}
