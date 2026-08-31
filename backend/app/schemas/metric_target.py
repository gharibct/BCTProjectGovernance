from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import StaffingPriority

# --- Development ---


class MetricTargetDevelopmentIn(BaseModel):
    target_productivity: Decimal | None = None
    target_effort_variation_pct: Decimal | None = None
    target_schedule_performance_index: Decimal | None = None
    target_cost_performance_index: Decimal | None = None
    target_defect_leakage_pct: Decimal | None = None
    target_code_coverage_pct: Decimal | None = None
    target_test_execution_coverage_pct: Decimal | None = None
    target_test_pass_rate_pct: Decimal | None = None


class MetricTargetDevelopmentRead(MetricTargetDevelopmentIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID


# --- Support ---


class MetricTargetSupportIn(BaseModel):
    target_incident_mttr_p1_hours: Decimal | None = None
    target_incident_mttr_p2_hours: Decimal | None = None
    target_incident_mttr_p3_hours: Decimal | None = None
    target_service_request_mttr_hours: Decimal | None = None
    target_user_clarification_mttr_hours: Decimal | None = None
    target_incident_sla_compliance_p1_pct: Decimal | None = None
    target_incident_sla_compliance_p2_pct: Decimal | None = None
    target_incident_sla_compliance_p3_pct: Decimal | None = None


class MetricTargetSupportRead(MetricTargetSupportIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID


# --- Staffing ---


class MetricTargetStaffingPriorityIn(BaseModel):
    priority: StaffingPriority
    target_avg_response_time_hours: Decimal | None = None
    target_avg_lead_time_days: Decimal | None = None


class MetricTargetStaffingPriorityRead(MetricTargetStaffingPriorityIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    metric_target_id: UUID


class MetricTargetStaffingIn(BaseModel):
    target_pct_profiles_qualifying: Decimal | None = None
    target_pct_candidates_joining: Decimal | None = None
    priority_targets: list[MetricTargetStaffingPriorityIn] = []


class MetricTargetStaffingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    target_pct_profiles_qualifying: Decimal | None = None
    target_pct_candidates_joining: Decimal | None = None
    priority_targets: list[MetricTargetStaffingPriorityRead] = []


# --- Testing ---


class MetricTargetTestingIn(BaseModel):
    target_test_execution_coverage_pct: Decimal | None = None
    target_test_pass_rate_pct: Decimal | None = None
    target_automation_coverage_pct: Decimal | None = None
    target_test_design_productivity: Decimal | None = None
    target_test_execution_productivity: Decimal | None = None


class MetricTargetTestingRead(MetricTargetTestingIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID


# --- Consulting ---


class MetricTargetConsultingIn(BaseModel):
    target_effort_variation_pct: Decimal | None = None
    target_schedule_performance_index: Decimal | None = None
    target_cost_performance_index: Decimal | None = None


class MetricTargetConsultingRead(MetricTargetConsultingIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID


# --- Cloud Maintenance ---


class MetricTargetCloudMaintenanceIn(BaseModel):
    target_service_availability_pct: Decimal | None = None
    target_application_availability_pct: Decimal | None = None


class MetricTargetCloudMaintenanceRead(MetricTargetCloudMaintenanceIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID


# --- Cloud Migration ---


class MetricTargetCloudMigrationIn(BaseModel):
    target_applications_migrated_pct: Decimal | None = None
    target_migration_success_rate_pct: Decimal | None = None
    target_migration_downtime_minutes: Decimal | None = None


class MetricTargetCloudMigrationRead(MetricTargetCloudMigrationIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
