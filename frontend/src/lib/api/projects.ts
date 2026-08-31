import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "./client";

export type ContractType = "FPP" | "T&M" | "Capped T&M" | "Internal";
export type ProjectOwned = "Fully Owned" | "Co-Owned" | "Customer Driven";
export type BillingType = "FPP" | "FB" | "T&M" | "Product" | "Unit Based Billing" | "Others";
export type EngagementType = "Implementation" | "Support";
export type YesNo = "Yes" | "No";
export type ApplicablePhase =
  | "Requirement"
  | "Design"
  | "CUT"
  | "Build & Deployment"
  | "Testing"
  | "UAT"
  | "Warranty"
  | "Support";
// Matches backend/app/schemas/enums.py's ProjectStatus. A project is
// "Draft" the moment it's created; the charter's Send To Approval / Approve
// actions move it through Pending Approval to Approved.
export type ProjectStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Hold"
  | "Closed"
  | "Open Only for Billing";
export type HealthRating = "Red" | "Potential Red" | "Amber" | "Green";

export type Project = {
  id: string;
  project_code: string;
  project_name: string;
  contract_type: ContractType | null;
  project_type_id: string | null;
  organization_id: string | null;
  project_owned: ProjectOwned | null;
  geo_id: string | null;
  region_id: string | null;
  account_id: string | null;
  project_manager_id: string | null;
  delivery_manager_id: string | null;
  delivery_excellence_id: string | null;
  customer_overview: string | null;
  project_scope_description: string | null;
  // Decimal — Pydantic serializes it as a JSON string, not a number, to
  // avoid float precision loss.
  project_revenue: string | null;
  project_currency: string | null;
  billing_type: BillingType | null;
  engagement_type: EngagementType | null;
  critical_flag: YesNo | null;
  product_flag: YesNo | null;
  product_id: string | null;
  planned_start_date: string | null;
  actual_start_date: string | null;
  planned_end_date: string | null;
  actual_end_date: string | null;
  applicable_phase: ApplicablePhase | null;
  project_status: ProjectStatus;
  planned_duration_days: number | null;
  actual_duration_days: number | null;
  delivery_declared_overall_health: HealthRating | null;
  de_assessed_project_health: HealthRating | null;
  overall_project_health: HealthRating | null;
  created_at: string;
  updated_at: string;
  // Derived server-side (see schemas/projects.py) — true only once every
  // field the Project Profile / Scope & Schedule screen collects is filled
  // in (not just the mandatory ones), for the New Project nav's completion
  // indicator. Saving with blanks is still allowed; this only affects the
  // "done" icon.
  profile_completion_flag: boolean;
  schedule_completion_flag: boolean;
};

// Fields the New Project charter screens collect. `undefined` means "leave
// unset" — the backend's PUT does a partial update (exclude_unset), so only
// keys present in the payload get written.
export type ProjectPayload = Partial<{
  project_name: string;
  contract_type: ContractType;
  project_type_id: string;
  organization_id: string;
  project_owned: ProjectOwned;
  geo_id: string;
  region_id: string;
  account_id: string;
  project_manager_id: string;
  delivery_manager_id: string;
  delivery_excellence_id: string;
  customer_overview: string;
  project_scope_description: string;
  project_revenue: string;
  project_currency: string;
  billing_type: BillingType;
  engagement_type: EngagementType;
  critical_flag: YesNo;
  product_flag: YesNo;
  product_id: string;
  planned_start_date: string;
  actual_start_date: string;
  planned_end_date: string;
  actual_end_date: string;
  applicable_phase: ApplicablePhase;
  project_status: ProjectStatus;
}>;

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Page<Project>>("/projects?limit=200"),
    select: (page) => page.items,
  });
}

export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.get<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectPayload) => api.post<Project>("/projects", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectPayload) => api.put<Project>(`/projects/${projectId}`, payload),
    // Re-fetch from the DB rather than trusting the PUT response body, so the
    // screen always reflects what's actually persisted (including any
    // server-computed columns) instead of an assumed-successful write.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// --- Resource Allocation (normally synced from BCT Oracle App; the backend
// also supports manual add/edit/delete, used by Project Reporting's
// register for the rare manual correction) ---

export type ProjectResource = {
  id: string;
  project_id: string;
  resource_name: string;
  oracle_resource_id: string | null;
  role: string | null;
  fte_allocation: string;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectResourceSummary = { head_count: number; total_fte: string };

export type ProjectResourcePayload = {
  resource_name: string;
  oracle_resource_id?: string;
  role?: string;
  fte_allocation: string;
};

export function useProjectResources(projectId: string | null) {
  return useQuery({
    queryKey: ["project-resources", projectId],
    queryFn: () => api.get<ProjectResource[]>(`/projects/${projectId}/resources`),
    enabled: !!projectId,
  });
}

export function useProjectResourceSummary(projectId: string | null) {
  return useQuery({
    queryKey: ["project-resource-summary", projectId],
    queryFn: () => api.get<ProjectResourceSummary>(`/projects/${projectId}/resources/summary`),
    enabled: !!projectId,
  });
}

function invalidateResources(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["project-resources", projectId] });
  queryClient.invalidateQueries({ queryKey: ["project-resource-summary", projectId] });
}

export function useCreateProjectResource(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectResourcePayload) =>
      api.post<ProjectResource>(`/projects/${projectId}/resources`, payload),
    onSuccess: () => invalidateResources(queryClient, projectId),
  });
}

export function useUpdateProjectResource(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectResourcePayload }) =>
      api.put<ProjectResource>(`/projects/${projectId}/resources/${id}`, payload),
    onSuccess: () => invalidateResources(queryClient, projectId),
  });
}

export function useDeleteProjectResource(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/resources/${id}`),
    onSuccess: () => invalidateResources(queryClient, projectId),
  });
}

// --- Oracle Project ID mapping ---

export type ProjectOracleId = { id: string; project_id: string; oracle_project_id: string; created_at: string };

export function useProjectOracleIds(projectId: string | null) {
  return useQuery({
    queryKey: ["project-oracle-ids", projectId],
    queryFn: () => api.get<ProjectOracleId[]>(`/projects/${projectId}/oracle-ids`),
    enabled: !!projectId,
  });
}

export function useAddOracleId(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (oracleProjectId: string) =>
      api.post<ProjectOracleId>(`/projects/${projectId}/oracle-ids`, { oracle_project_id: oracleProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-oracle-ids", projectId] });
    },
  });
}

export function useDeleteOracleId(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (oracleIdId: string) => api.delete(`/projects/${projectId}/oracle-ids/${oracleIdId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-oracle-ids", projectId] });
    },
  });
}

// Creates the project and maps every pending Oracle Project ID onto it in
// one client-side operation, so New Project Creation can require at least
// one Oracle mapping before the project exists at all (no projectId is
// available yet to instantiate useAddOracleId with).
export function useCreateProjectWithOracleIds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      payload,
      oracleProjectIds,
    }: {
      payload: ProjectPayload;
      oracleProjectIds: string[];
    }) => {
      const project = await api.post<Project>("/projects", payload);
      for (const oracleProjectId of oracleProjectIds) {
        await api.post<ProjectOracleId>(`/projects/${project.id}/oracle-ids`, {
          oracle_project_id: oracleProjectId,
        });
      }
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-oracle-ids", project.id] });
    },
  });
}
