import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "./client";

// Metric Targets (backend/app/api/v1/endpoints/metric_target.py) are one row
// per project, no reporting period, so unlike Measurement Entry there's no
// list — just a get-or-404 / upsert pair per Project Type.
function useMetricTarget<T>(projectId: string | null, prefix: string, enabled = true) {
  return useQuery({
    queryKey: ["metric-target", prefix, projectId],
    queryFn: async () => {
      try {
        return await api.get<T>(`/projects/${projectId}/metric-targets/${prefix}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!projectId && enabled,
  });
}

function useSaveMetricTarget<TPayload, TRead>(projectId: string | null, prefix: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TPayload) => api.put<TRead>(`/projects/${projectId}/metric-targets/${prefix}`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["metric-target", prefix, projectId], data);
    },
  });
}

// --- Development ---

export type MetricTargetDevelopment = {
  id: string;
  project_id: string;
  target_productivity: number | null;
  target_effort_variation_pct: number | null;
  target_schedule_performance_index: number | null;
  target_cost_performance_index: number | null;
  target_defect_leakage_pct: number | null;
  target_code_coverage_pct: number | null;
  target_test_execution_coverage_pct: number | null;
  target_test_pass_rate_pct: number | null;
};

export type MetricTargetDevelopmentPayload = Omit<MetricTargetDevelopment, "id" | "project_id">;

export const useDevelopmentTarget = (projectId: string | null, enabled = true) =>
  useMetricTarget<MetricTargetDevelopment>(projectId, "development", enabled);
export const useSaveDevelopmentTarget = (projectId: string | null) =>
  useSaveMetricTarget<MetricTargetDevelopmentPayload, MetricTargetDevelopment>(projectId, "development");

// --- Support ---

export type MetricTargetSupport = {
  id: string;
  project_id: string;
  target_incident_mttr_p1_hours: number | null;
  target_incident_mttr_p2_hours: number | null;
  target_incident_mttr_p3_hours: number | null;
  target_service_request_mttr_hours: number | null;
  target_user_clarification_mttr_hours: number | null;
  target_incident_sla_compliance_p1_pct: number | null;
  target_incident_sla_compliance_p2_pct: number | null;
  target_incident_sla_compliance_p3_pct: number | null;
};

export type MetricTargetSupportPayload = Omit<MetricTargetSupport, "id" | "project_id">;

export const useSupportTarget = (projectId: string | null, enabled = true) =>
  useMetricTarget<MetricTargetSupport>(projectId, "support", enabled);
export const useSaveSupportTarget = (projectId: string | null) =>
  useSaveMetricTarget<MetricTargetSupportPayload, MetricTargetSupport>(projectId, "support");

// --- Staffing ---

export type StaffingPriorityCode = "Critical" | "High" | "Medium" | "Low";

export type MetricTargetStaffingPriority = {
  id: string;
  metric_target_id: string;
  priority: StaffingPriorityCode;
  target_avg_response_time_hours: number | null;
  target_avg_lead_time_days: number | null;
};

export type MetricTargetStaffing = {
  id: string;
  project_id: string;
  target_pct_profiles_qualifying: number | null;
  target_pct_candidates_joining: number | null;
  priority_targets: MetricTargetStaffingPriority[];
};

export type MetricTargetStaffingPayload = {
  target_pct_profiles_qualifying: number | null;
  target_pct_candidates_joining: number | null;
  priority_targets: {
    priority: StaffingPriorityCode;
    target_avg_response_time_hours: number | null;
    target_avg_lead_time_days: number | null;
  }[];
};

export const useStaffingTarget = (projectId: string | null, enabled = true) =>
  useMetricTarget<MetricTargetStaffing>(projectId, "staffing", enabled);
export const useSaveStaffingTarget = (projectId: string | null) =>
  useSaveMetricTarget<MetricTargetStaffingPayload, MetricTargetStaffing>(projectId, "staffing");

// --- Testing ---

export type MetricTargetTesting = {
  id: string;
  project_id: string;
  target_test_execution_coverage_pct: number | null;
  target_test_pass_rate_pct: number | null;
  target_automation_coverage_pct: number | null;
  target_test_design_productivity: number | null;
  target_test_execution_productivity: number | null;
};

export type MetricTargetTestingPayload = Omit<MetricTargetTesting, "id" | "project_id">;

export const useTestingTarget = (projectId: string | null, enabled = true) =>
  useMetricTarget<MetricTargetTesting>(projectId, "testing", enabled);
export const useSaveTestingTarget = (projectId: string | null) =>
  useSaveMetricTarget<MetricTargetTestingPayload, MetricTargetTesting>(projectId, "testing");

// --- Consulting ---

export type MetricTargetConsulting = {
  id: string;
  project_id: string;
  target_effort_variation_pct: number | null;
  target_schedule_performance_index: number | null;
  target_cost_performance_index: number | null;
};

export type MetricTargetConsultingPayload = Omit<MetricTargetConsulting, "id" | "project_id">;

export const useConsultingTarget = (projectId: string | null, enabled = true) =>
  useMetricTarget<MetricTargetConsulting>(projectId, "consulting", enabled);
export const useSaveConsultingTarget = (projectId: string | null) =>
  useSaveMetricTarget<MetricTargetConsultingPayload, MetricTargetConsulting>(projectId, "consulting");

// --- Cloud Maintenance ---

export type MetricTargetCloudMaintenance = {
  id: string;
  project_id: string;
  target_service_availability_pct: number | null;
  target_application_availability_pct: number | null;
};

export type MetricTargetCloudMaintenancePayload = Omit<MetricTargetCloudMaintenance, "id" | "project_id">;

export const useCloudMaintenanceTarget = (projectId: string | null, enabled = true) =>
  useMetricTarget<MetricTargetCloudMaintenance>(projectId, "cloud-maintenance", enabled);
export const useSaveCloudMaintenanceTarget = (projectId: string | null) =>
  useSaveMetricTarget<MetricTargetCloudMaintenancePayload, MetricTargetCloudMaintenance>(projectId, "cloud-maintenance");

// --- Cloud Migration ---

export type MetricTargetCloudMigration = {
  id: string;
  project_id: string;
  target_applications_migrated_pct: number | null;
  target_migration_success_rate_pct: number | null;
  target_migration_downtime_minutes: number | null;
};

export type MetricTargetCloudMigrationPayload = Omit<MetricTargetCloudMigration, "id" | "project_id">;

export const useCloudMigrationTarget = (projectId: string | null, enabled = true) =>
  useMetricTarget<MetricTargetCloudMigration>(projectId, "cloud-migration", enabled);
export const useSaveCloudMigrationTarget = (projectId: string | null) =>
  useSaveMetricTarget<MetricTargetCloudMigrationPayload, MetricTargetCloudMigration>(projectId, "cloud-migration");
