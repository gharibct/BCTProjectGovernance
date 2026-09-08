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
  oracle_project_ids: string[];
  requested_by: string | null;
  requested_by_name: string | null;
  status: string;
  created_at: string;
};

export type ProjectCreationRequestPayload = {
  project_name: string;
  project_manager_id: string | null;
  oracle_project_ids: string[];
};

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
    mutationFn: (id: string) => api.delete(`/project-creation-requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
