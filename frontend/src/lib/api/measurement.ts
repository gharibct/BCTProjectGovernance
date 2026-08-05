import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

export type SdlcStage =
  | "URD"
  | "Proto"
  | "SRS"
  | "ADD"
  | "HLD"
  | "USP/LLD"
  | "Code"
  | "UTC"
  | "SITC"
  | "UT"
  | "SIT";
export type StaffingPriorityCode = "Critical" | "High" | "Medium" | "Low";

// Each Measurement tab is its own append-only history — same pattern as
// Health Declarations / DE Assessments: "latest" 404s until the first entry
// for this project exists (swallowed to null, a normal state), and Save
// always POSTs a new row for the selected Reporting Period rather than
// editing a prior one in place.

// --- Development (bespoke: per-SDLC-stage defect rows) ---

export type MeasurementDevelopmentDefect = {
  sdlc_stage: SdlcStage;
  internal_defects: number;
  external_defects: number;
};

export type MeasurementDevelopmentPayload = {
  period_id: string;
  overall_planned_size?: string;
  actual_size?: string;
  overall_estimated_effort?: string;
  planned_effort_as_on_date?: string;
  actual_effort_as_on_date?: string;
  planned_pct_completion?: string;
  actual_pct_completion?: string;
  uat_defects_external?: string;
  production_defects_external?: string;
  total_test_cases_designed?: string;
  executed_test_cases?: string;
  passed_test_cases?: string;
  last_updated_date?: string;
  defects_by_stage: MeasurementDevelopmentDefect[];
};

export type MeasurementDevelopmentRead = {
  id: string;
  project_id: string;
  period_id: string;
  overall_planned_size: string | null;
  actual_size: string | null;
  overall_estimated_effort: string | null;
  planned_effort_as_on_date: string | null;
  actual_effort_as_on_date: string | null;
  planned_pct_completion: string | null;
  actual_pct_completion: string | null;
  uat_defects_external: number | null;
  production_defects_external: number | null;
  total_test_cases_designed: number | null;
  executed_test_cases: number | null;
  passed_test_cases: number | null;
  productivity: string | null;
  effort_variation_pct: string | null;
  schedule_performance_index: string | null;
  cost_performance_index: string | null;
  defect_leakage_pct: string | null;
  code_coverage_pct: string | null;
  test_execution_coverage_pct: string | null;
  test_pass_rate_pct: string | null;
  last_updated_date: string | null;
  defects_by_stage: (MeasurementDevelopmentDefect & { id: string; measurement_id: string })[];
  created_at: string;
  updated_at: string;
};

export function useLatestDevelopmentMeasurement(projectId: string | null) {
  return useQuery({
    queryKey: ["measurement-development-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<MeasurementDevelopmentRead>(`/projects/${projectId}/measurements/development/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

export function useCreateDevelopmentMeasurement(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MeasurementDevelopmentPayload) =>
      api.post<MeasurementDevelopmentRead>(`/projects/${projectId}/measurements/development`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-development-latest", projectId] });
    },
  });
}

// --- Support ---

export type MeasurementSupportPayload = {
  period_id: string;
  incidents_p1_count?: string;
  incidents_p1_person_days?: string;
  incidents_p2_count?: string;
  incidents_p2_person_days?: string;
  incidents_p3_count?: string;
  incidents_p3_person_days?: string;
  service_requests_count?: string;
  user_clarifications_count?: string;
  tickets_reopened_count?: string;
  aging_tickets_count?: string;
  first_time_resolutions_count?: string;
  last_updated_date?: string;
};

export type MeasurementSupportRead = {
  id: string;
  project_id: string;
  period_id: string;
  incidents_p1_count: number | null;
  incidents_p1_person_days: string | null;
  incidents_p2_count: number | null;
  incidents_p2_person_days: string | null;
  incidents_p3_count: number | null;
  incidents_p3_person_days: string | null;
  service_requests_count: number | null;
  user_clarifications_count: number | null;
  tickets_reopened_count: number | null;
  aging_tickets_count: number | null;
  first_time_resolutions_count: number | null;
  incident_sla_compliance_p1_pct: string | null;
  incident_sla_compliance_p2_pct: string | null;
  incident_sla_compliance_p3_pct: string | null;
  incident_mttr_hours: string | null;
  service_request_mttr_hours: string | null;
  user_clarification_mttr_hours: string | null;
  last_updated_date: string | null;
  created_at: string;
  updated_at: string;
};

export function useLatestSupportMeasurement(projectId: string | null) {
  return useQuery({
    queryKey: ["measurement-support-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<MeasurementSupportRead>(`/projects/${projectId}/measurements/support/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

export function useCreateSupportMeasurement(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MeasurementSupportPayload) =>
      api.post<MeasurementSupportRead>(`/projects/${projectId}/measurements/support`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-support-latest", projectId] });
    },
  });
}

// --- Staffing (bespoke: per-priority response/lead time rows) ---

export type MeasurementStaffingPriorityMetric = {
  priority: StaffingPriorityCode;
  response_time_hours?: string;
  lead_time_days?: string;
};

export type MeasurementStaffingPayload = {
  period_id: string;
  requests_count?: string;
  profiles_submitted_count?: string;
  client_interviews_count?: string;
  interview_selects_count?: string;
  associates_joined_count?: string;
  last_updated_date?: string;
  priority_metrics: MeasurementStaffingPriorityMetric[];
};

export type MeasurementStaffingRead = {
  id: string;
  project_id: string;
  period_id: string;
  requests_count: number | null;
  profiles_submitted_count: number | null;
  client_interviews_count: number | null;
  interview_selects_count: number | null;
  associates_joined_count: number | null;
  pct_profiles_qualifying: string | null;
  pct_candidates_joining: string | null;
  last_updated_date: string | null;
  priority_metrics: (MeasurementStaffingPriorityMetric & {
    id: string;
    measurement_id: string;
    avg_response_time_hours: string | null;
    avg_lead_time_days: string | null;
  })[];
  created_at: string;
  updated_at: string;
};

export function useLatestStaffingMeasurement(projectId: string | null) {
  return useQuery({
    queryKey: ["measurement-staffing-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<MeasurementStaffingRead>(`/projects/${projectId}/measurements/staffing/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

export function useCreateStaffingMeasurement(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MeasurementStaffingPayload) =>
      api.post<MeasurementStaffingRead>(`/projects/${projectId}/measurements/staffing`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-staffing-latest", projectId] });
    },
  });
}

// --- Testing ---

export type MeasurementTestingPayload = {
  period_id: string;
  total_test_cases_designed?: string;
  executed_test_cases?: string;
  passed_test_cases?: string;
  automated_test_cases?: string;
  effort_test_case_design?: string;
  effort_test_execution?: string;
  last_updated_date?: string;
};

export type MeasurementTestingRead = {
  id: string;
  project_id: string;
  period_id: string;
  total_test_cases_designed: number | null;
  executed_test_cases: number | null;
  passed_test_cases: number | null;
  automated_test_cases: number | null;
  effort_test_case_design: string | null;
  effort_test_execution: string | null;
  test_execution_coverage_pct: string | null;
  test_pass_rate_pct: string | null;
  automation_coverage_pct: string | null;
  test_design_productivity: string | null;
  test_execution_productivity: string | null;
  last_updated_date: string | null;
  created_at: string;
  updated_at: string;
};

export function useLatestTestingMeasurement(projectId: string | null) {
  return useQuery({
    queryKey: ["measurement-testing-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<MeasurementTestingRead>(`/projects/${projectId}/measurements/testing/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

export function useCreateTestingMeasurement(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MeasurementTestingPayload) =>
      api.post<MeasurementTestingRead>(`/projects/${projectId}/measurements/testing`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-testing-latest", projectId] });
    },
  });
}

// --- Cloud Maintenance ---

export type MeasurementCloudMaintenancePayload = {
  period_id: string;
  total_uptime_hours?: string;
  total_scheduled_time_hours?: string;
  application_downtime_hours?: string;
  last_updated_date?: string;
};

export type MeasurementCloudMaintenanceRead = {
  id: string;
  project_id: string;
  period_id: string;
  total_uptime_hours: string | null;
  total_scheduled_time_hours: string | null;
  application_downtime_hours: string | null;
  service_availability_pct: string | null;
  application_availability_pct: string | null;
  last_updated_date: string | null;
  created_at: string;
  updated_at: string;
};

export function useLatestCloudMaintenanceMeasurement(projectId: string | null) {
  return useQuery({
    queryKey: ["measurement-cloud-maintenance-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<MeasurementCloudMaintenanceRead>(
          `/projects/${projectId}/measurements/cloud-maintenance/latest`
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

export function useCreateCloudMaintenanceMeasurement(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MeasurementCloudMaintenancePayload) =>
      api.post<MeasurementCloudMaintenanceRead>(`/projects/${projectId}/measurements/cloud-maintenance`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-cloud-maintenance-latest", projectId] });
    },
  });
}

// --- Cloud Migration (event-based: as_of_date instead of period_id) ---

export type MeasurementCloudMigrationPayload = {
  as_of_date: string;
  planned_application_migration_count?: string;
  applications_migrated_count?: string;
  total_migration_attempts?: string;
  successful_migrations?: string;
  migration_start_time?: string;
  migration_end_time?: string;
  last_updated_date?: string;
};

export type MeasurementCloudMigrationRead = {
  id: string;
  project_id: string;
  as_of_date: string;
  planned_application_migration_count: number | null;
  applications_migrated_count: number | null;
  total_migration_attempts: number | null;
  successful_migrations: number | null;
  migration_start_time: string | null;
  migration_end_time: string | null;
  applications_migrated_pct: string | null;
  migration_success_rate_pct: string | null;
  migration_downtime_minutes: string | null;
  last_updated_date: string | null;
  created_at: string;
  updated_at: string;
};

export function useLatestCloudMigrationMeasurement(projectId: string | null) {
  return useQuery({
    queryKey: ["measurement-cloud-migration-latest", projectId],
    queryFn: async () => {
      try {
        return await api.get<MeasurementCloudMigrationRead>(
          `/projects/${projectId}/measurements/cloud-migration/latest`
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId,
  });
}

export function useCreateCloudMigrationMeasurement(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MeasurementCloudMigrationPayload) =>
      api.post<MeasurementCloudMigrationRead>(`/projects/${projectId}/measurements/cloud-migration`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-cloud-migration-latest", projectId] });
    },
  });
}
