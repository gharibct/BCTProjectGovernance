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

// Reverse lookup for Project Profile's read-only "Geo Head" field — the user
// currently mapped as Geo Head for the given geo (via the same user_geos
// scope Admin's User Directory manages), or null if none is mapped yet.
export function useGeoHead(geoId: string | null) {
  return useQuery({
    queryKey: ["geo-head", geoId],
    queryFn: () => api.get<User | null>(`/geos/${geoId}/geo-head`),
    enabled: !!geoId,
  });
}

// Reverse lookup of user_accounts (account -> user): the Account Head
// (ACCOUNT_MANAGER assigned to the account), or null if none is mapped yet.
// Used to default an Account-level Action's owner.
export function useAccountHead(accountId: string | null) {
  return useQuery({
    queryKey: ["account-head", accountId],
    queryFn: () => api.get<User | null>(`/accounts/${accountId}/account-head`),
    enabled: !!accountId,
  });
}

export function useSetUserAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accountIds }: { userId: string; accountIds: string[] }) =>
      api.put<string[]>(`/users/${userId}/accounts`, { account_ids: accountIds }),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["user-accounts", userId] });
      // Same rationale as useSetUserGeos below — this can reassign the Account
      // Head for any account, so refetch every mounted "Account Head" display.
      queryClient.invalidateQueries({ queryKey: ["account-head"] });
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
      // This mutation can add/remove the Geo Head for any geo (not just this
      // user's own list), so refetch every mounted "Geo Head" display rather
      // than trying to figure out which specific geo_id(s) changed.
      queryClient.invalidateQueries({ queryKey: ["geo-head"] });
    },
  });
}
