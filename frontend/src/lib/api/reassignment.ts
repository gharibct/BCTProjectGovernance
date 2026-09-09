import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// Reassign Owners (backend/app/api/v1/endpoints/reassignment.py) — a Geo Head or
// Delivery Excellence user changes a Project's Project Manager, an Account's
// Account Manager, or a Geo's Geo Head at any time, independent of the
// project/amendment workflow. The server scopes each list by role: a Geo Head
// only sees entities within their own owned geo(s); DE / Admin see everything.

export type ReassignProjectRow = {
  project_id: string;
  project_code: string;
  project_name: string;
  account_name: string | null;
  geo_name: string | null;
  region_name: string | null;
  project_manager_id: string | null;
  project_manager_name: string | null;
};

export type ReassignAccountRow = {
  account_id: string;
  account_name: string;
  geo_name: string | null;
  account_manager_id: string | null;
  account_manager_name: string | null;
};

export type ReassignGeoRow = {
  geo_id: string;
  geo_code: string;
  geo_name: string;
  geo_head_id: string | null;
  geo_head_name: string | null;
};

export function useReassignableProjects() {
  return useQuery({
    queryKey: ["reassignment", "projects"],
    queryFn: () => api.get<ReassignProjectRow[]>("/reassignment/projects"),
  });
}

export function useReassignableAccounts() {
  return useQuery({
    queryKey: ["reassignment", "accounts"],
    queryFn: () => api.get<ReassignAccountRow[]>("/reassignment/accounts"),
  });
}

export function useReassignableGeos() {
  return useQuery({
    queryKey: ["reassignment", "geos"],
    queryFn: () => api.get<ReassignGeoRow[]>("/reassignment/geos"),
  });
}

export function useReassignProjectManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      api.patch<ReassignProjectRow>(`/reassignment/projects/${projectId}`, {
        project_manager_id: userId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reassignment", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useReassignAccountManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, userId }: { accountId: string; userId: string }) =>
      api.patch<ReassignAccountRow>(`/reassignment/accounts/${accountId}`, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reassignment", "accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-head"] });
    },
  });
}

export function useReassignGeoHead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ geoId, userId }: { geoId: string; userId: string }) =>
      api.patch<ReassignGeoRow>(`/reassignment/geos/${geoId}`, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reassignment", "geos"] });
      queryClient.invalidateQueries({ queryKey: ["geo-head"] });
    },
  });
}
