import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { Project } from "./projects";

// New Project Creation flow. An Account Head / Geo Head submits a lightweight
// request (name + Project Manager + Oracle Project IDs); Delivery Excellence
// approves it — which creates the real Draft project — or rejects it (delete).

export type ProjectCreationRequestRow = {
  id: string;
  project_name: string;
  project_manager_id: string | null;
  project_manager_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  geo_id: string | null;
  geo_name: string | null;
  region_id: string | null;
  region_name: string | null;
  account_id: string | null;
  account_name: string | null;
  oracle_project_ids: string[];
  requested_by: string | null;
  requested_by_name: string | null;
  status: string;
  review_remarks: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ProjectCreationRequestPayload = {
  project_name: string;
  project_manager_id: string | null;
  organization_id: string | null;
  geo_id: string | null;
  region_id: string | null;
  account_id: string | null;
  oracle_project_ids: string[];
};

// Project Profile pre-fill for an Oracle Project ID (from oracle_project_master).
// `found` is false for an unknown ID; any id that couldn't be resolved is null
// and explained in `notes`, so the requester picks it by hand.
export type OracleProjectProfile = {
  found: boolean;
  oracle_project_id: string;
  oracle_project_name: string | null;
  oracle_project_geo: string | null;
  oracle_account_name: string | null;
  organization_id: string | null;
  geo_id: string | null;
  region_id: string | null;
  account_id: string | null;
  notes: string[];
  // Set when the ID may not be added: not in the master, already mapped to a
  // project (any status), or on another pending creation request.
  blocked_reason: string | null;
};

export function fetchOracleProjectProfile(oracleProjectId: string) {
  return api.get<OracleProjectProfile>(
    `/project-creation-requests/oracle-project-profile/${encodeURIComponent(oracleProjectId)}`
  );
}

const KEY = ["project-creation-requests"] as const;

export function useProjectCreationRequests() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<ProjectCreationRequestRow[]>("/project-creation-requests"),
  });
}

export function useCreateProjectCreationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectCreationRequestPayload) =>
      api.post<ProjectCreationRequestRow>("/project-creation-requests", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useApproveProjectCreationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewedBy, remarks }: { id: string; reviewedBy: string; remarks?: string }) =>
      api.post<Project>(`/project-creation-requests/${id}/approve`, {
        reviewed_by: reviewedBy,
        remarks: remarks ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useRejectProjectCreationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewedBy, remarks }: { id: string; reviewedBy: string; remarks: string }) =>
      api.post<ProjectCreationRequestRow>(`/project-creation-requests/${id}/reject`, {
        reviewed_by: reviewedBy,
        remarks,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
