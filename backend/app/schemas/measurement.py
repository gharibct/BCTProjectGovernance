from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import SdlcStage, StaffingPriority

# --- Development ---


class MeasurementDevelopmentDefectIn(BaseModel):
    sdlc_stage: SdlcStage
    internal_defects: int = 0
    external_defects: int = 0


class MeasurementDevelopmentDefectRead(MeasurementDevelopmentDefectIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    measurement_id: UUID


class MeasurementDevelopmentCreate(BaseModel):
    period_id: UUID
    overall_planned_size: Decimal | None = None
    actual_size: Decimal | None = None
    overall_estimated_effort: Decimal | None = None
    planned_effort_as_on_date: Decimal | None = None
    actual_effort_as_on_date: Decimal | None = None
    planned_pct_completion: Decimal | None = None
    actual_pct_completion: Decimal | None = None
    uat_defects_external: int | None = None
    production_defects_external: int | None = None
    total_test_cases_designed: int | None = None
    executed_test_cases: int | None = None
    passed_test_cases: int | None = None
    last_updated_date: date | None = None
    defects_by_stage: list[MeasurementDevelopmentDefectIn] = []


class MeasurementDevelopmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    overall_planned_size: Decimal | None = None
    actual_size: Decimal | None = None
    overall_estimated_effort: Decimal | None = None
    planned_effort_as_on_date: Decimal | None = None
    actual_effort_as_on_date: Decimal | None = None
    planned_pct_completion: Decimal | None = None
    actual_pct_completion: Decimal | None = None
    uat_defects_external: int | None = None
    production_defects_external: int | None = None
    total_test_cases_designed: int | None = None
    executed_test_cases: int | None = None
    passed_test_cases: int | None = None
    productivity: Decimal | None = None
    effort_variation_pct: Decimal | None = None
    schedule_performance_index: Decimal | None = None
    cost_performance_index: Decimal | None = None
    defect_leakage_pct: Decimal | None = None
    code_coverage_pct: Decimal | None = None
    test_execution_coverage_pct: Decimal | None = None
    test_pass_rate_pct: Decimal | None = None
    last_updated_date: date | None = None
    created_at: datetime
    updated_at: datetime


class MeasurementDevelopmentReadWithDefects(MeasurementDevelopmentRead):
    defects_by_stage: list[MeasurementDevelopmentDefectRead] = []


class MeasurementDevelopmentUpdate(BaseModel):
    """Updates raw inputs only — use the defects sub-resource to change per-stage counts."""

    overall_planned_size: Decimal | None = None
    actual_size: Decimal | None = None
    overall_estimated_effort: Decimal | None = None
    planned_effort_as_on_date: Decimal | None = None
    actual_effort_as_on_date: Decimal | None = None
    planned_pct_completion: Decimal | None = None
    actual_pct_completion: Decimal | None = None
    uat_defects_external: int | None = None
    production_defects_external: int | None = None
    total_test_cases_designed: int | None = None
    executed_test_cases: int | None = None
    passed_test_cases: int | None = None
    last_updated_date: date | None = None


# --- Support ---


class MeasurementSupportCreate(BaseModel):
    period_id: UUID
    incidents_p1_count: int | None = None
    incidents_p1_person_days: Decimal | None = None
    incidents_p2_count: int | None = None
    incidents_p2_person_days: Decimal | None = None
    incidents_p3_count: int | None = None
    incidents_p3_person_days: Decimal | None = None
    service_requests_count: int | None = None
    user_clarifications_count: int | None = None
    tickets_reopened_count: int | None = None
    aging_tickets_count: int | None = None
    first_time_resolutions_count: int | None = None
    last_updated_date: date | None = None


class MeasurementSupportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    incidents_p1_count: int | None = None
    incidents_p1_person_days: Decimal | None = None
    incidents_p2_count: int | None = None
    incidents_p2_person_days: Decimal | None = None
    incidents_p3_count: int | None = None
    incidents_p3_person_days: Decimal | None = None
    service_requests_count: int | None = None
    user_clarifications_count: int | None = None
    tickets_reopened_count: int | None = None
    aging_tickets_count: int | None = None
    first_time_resolutions_count: int | None = None
    incident_sla_compliance_p1_pct: Decimal | None = None
    incident_sla_compliance_p2_pct: Decimal | None = None
    incident_sla_compliance_p3_pct: Decimal | None = None
    incident_mttr_hours: Decimal | None = None
    service_request_mttr_hours: Decimal | None = None
    user_clarification_mttr_hours: Decimal | None = None
    last_updated_date: date | None = None
    created_at: datetime
    updated_at: datetime


# --- Staffing ---


class MeasurementStaffingPriorityMetricIn(BaseModel):
    priority: StaffingPriority
    response_time_hours: Decimal | None = None
    lead_time_days: Decimal | None = None


class MeasurementStaffingPriorityMetricRead(MeasurementStaffingPriorityMetricIn):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    measurement_id: UUID
    avg_response_time_hours: Decimal | None = None
    avg_lead_time_days: Decimal | None = None


class MeasurementStaffingCreate(BaseModel):
    period_id: UUID
    requests_count: int | None = None
    profiles_submitted_count: int | None = None
    client_interviews_count: int | None = None
    interview_selects_count: int | None = None
    associates_joined_count: int | None = None
    last_updated_date: date | None = None
    priority_metrics: list[MeasurementStaffingPriorityMetricIn] = []


class MeasurementStaffingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    requests_count: int | None = None
    profiles_submitted_count: int | None = None
    client_interviews_count: int | None = None
    interview_selects_count: int | None = None
    associates_joined_count: int | None = None
    pct_profiles_qualifying: Decimal | None = None
    pct_candidates_joining: Decimal | None = None
    last_updated_date: date | None = None
    created_at: datetime
    updated_at: datetime


class MeasurementStaffingReadWithPriorities(MeasurementStaffingRead):
    priority_metrics: list[MeasurementStaffingPriorityMetricRead] = []


class MeasurementStaffingUpdate(BaseModel):
    """Updates raw inputs only — use the priority-metrics sub-resource to change per-priority values."""

    requests_count: int | None = None
    profiles_submitted_count: int | None = None
    client_interviews_count: int | None = None
    interview_selects_count: int | None = None
    associates_joined_count: int | None = None
    last_updated_date: date | None = None


# --- Testing ---


class MeasurementTestingCreate(BaseModel):
    period_id: UUID
    total_test_cases_designed: int | None = None
    executed_test_cases: int | None = None
    passed_test_cases: int | None = None
    automated_test_cases: int | None = None
    effort_test_case_design: Decimal | None = None
    effort_test_execution: Decimal | None = None
    last_updated_date: date | None = None


class MeasurementTestingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    total_test_cases_designed: int | None = None
    executed_test_cases: int | None = None
    passed_test_cases: int | None = None
    automated_test_cases: int | None = None
    effort_test_case_design: Decimal | None = None
    effort_test_execution: Decimal | None = None
    test_execution_coverage_pct: Decimal | None = None
    test_pass_rate_pct: Decimal | None = None
    automation_coverage_pct: Decimal | None = None
    test_design_productivity: Decimal | None = None
    test_execution_productivity: Decimal | None = None
    last_updated_date: date | None = None
    created_at: datetime
    updated_at: datetime


# --- Consulting ---


class MeasurementConsultingCreate(BaseModel):
    period_id: UUID
    planned_effort_as_on_date: Decimal | None = None
    actual_effort_as_on_date: Decimal | None = None
    planned_pct_completion: Decimal | None = None
    actual_pct_completion: Decimal | None = None
    planned_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    last_updated_date: date | None = None


class MeasurementConsultingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    planned_effort_as_on_date: Decimal | None = None
    actual_effort_as_on_date: Decimal | None = None
    planned_pct_completion: Decimal | None = None
    actual_pct_completion: Decimal | None = None
    planned_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    effort_variation_pct: Decimal | None = None
    schedule_performance_index: Decimal | None = None
    cost_performance_index: Decimal | None = None
    last_updated_date: date | None = None
    created_at: datetime
    updated_at: datetime


# --- Cloud Maintenance ---


class MeasurementCloudMaintenanceCreate(BaseModel):
    period_id: UUID
    total_uptime_hours: Decimal | None = None
    total_scheduled_time_hours: Decimal | None = None
    application_downtime_hours: Decimal | None = None
    last_updated_date: date | None = None


class MeasurementCloudMaintenanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    total_uptime_hours: Decimal | None = None
    total_scheduled_time_hours: Decimal | None = None
    application_downtime_hours: Decimal | None = None
    service_availability_pct: Decimal | None = None
    application_availability_pct: Decimal | None = None
    last_updated_date: date | None = None
    created_at: datetime
    updated_at: datetime


# --- Cloud Migration ---


class MeasurementCloudMigrationCreate(BaseModel):
    as_of_date: date
    planned_application_migration_count: int | None = None
    applications_migrated_count: int | None = None
    total_migration_attempts: int | None = None
    successful_migrations: int | None = None
    migration_start_time: datetime | None = None
    migration_end_time: datetime | None = None
    last_updated_date: date | None = None


class MeasurementCloudMigrationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    as_of_date: date
    planned_application_migration_count: int | None = None
    applications_migrated_count: int | None = None
    total_migration_attempts: int | None = None
    successful_migrations: int | None = None
    migration_start_time: datetime | None = None
    migration_end_time: datetime | None = None
    applications_migrated_pct: Decimal | None = None
    migration_success_rate_pct: Decimal | None = None
    migration_downtime_minutes: Decimal | None = None
    last_updated_date: date | None = None
    created_at: datetime
    updated_at: datetime
