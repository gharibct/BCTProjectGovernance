import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class MeasurementDevelopment(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "measurement_development"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    as_of_date: Mapped[date]

    overall_planned_size: Mapped[Decimal | None] = mapped_column(Numeric)
    actual_size: Mapped[Decimal | None] = mapped_column(Numeric)
    overall_estimated_effort: Mapped[Decimal | None] = mapped_column(Numeric)
    planned_effort_as_on_date: Mapped[Decimal | None] = mapped_column(Numeric)
    actual_effort_as_on_date: Mapped[Decimal | None] = mapped_column(Numeric)
    planned_pct_completion: Mapped[Decimal | None] = mapped_column(Numeric)
    actual_pct_completion: Mapped[Decimal | None] = mapped_column(Numeric)

    uat_defects_external: Mapped[int | None]
    production_defects_external: Mapped[int | None]
    total_test_cases_designed: Mapped[int | None]
    executed_test_cases: Mapped[int | None]
    passed_test_cases: Mapped[int | None]

    # Computed by services.measurement_metrics, read-only in the UI.
    productivity: Mapped[Decimal | None] = mapped_column(Numeric)
    effort_variation_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    schedule_performance_index: Mapped[Decimal | None] = mapped_column(Numeric)
    cost_performance_index: Mapped[Decimal | None] = mapped_column(Numeric)
    defect_leakage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    code_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    test_execution_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    test_pass_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric)

    last_updated_date: Mapped[date | None]


class MeasurementDevelopmentDefect(Base, UUIDPrimaryKey):
    __tablename__ = "measurement_development_defects"

    measurement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("measurement_development.id", ondelete="CASCADE")
    )
    sdlc_stage: Mapped[str]
    internal_defects: Mapped[int]
    external_defects: Mapped[int]


class MeasurementSupport(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "measurement_support"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    as_of_date: Mapped[date]

    incidents_p1_count: Mapped[int | None]
    incidents_p1_person_days: Mapped[Decimal | None] = mapped_column(Numeric)
    incidents_p2_count: Mapped[int | None]
    incidents_p2_person_days: Mapped[Decimal | None] = mapped_column(Numeric)
    incidents_p3_count: Mapped[int | None]
    incidents_p3_person_days: Mapped[Decimal | None] = mapped_column(Numeric)
    service_requests_count: Mapped[int | None]
    user_clarifications_count: Mapped[int | None]
    tickets_reopened_count: Mapped[int | None]
    aging_tickets_count: Mapped[int | None]
    first_time_resolutions_count: Mapped[int | None]

    incident_sla_compliance_p1_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    incident_sla_compliance_p2_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    incident_sla_compliance_p3_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    incident_mttr_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    service_request_mttr_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    user_clarification_mttr_hours: Mapped[Decimal | None] = mapped_column(Numeric)

    last_updated_date: Mapped[date | None]


class MeasurementStaffing(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "measurement_staffing"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    as_of_date: Mapped[date]

    requests_count: Mapped[int | None]
    profiles_submitted_count: Mapped[int | None]
    client_interviews_count: Mapped[int | None]
    interview_selects_count: Mapped[int | None]
    associates_joined_count: Mapped[int | None]

    pct_profiles_qualifying: Mapped[Decimal | None] = mapped_column(Numeric)
    pct_candidates_joining: Mapped[Decimal | None] = mapped_column(Numeric)

    last_updated_date: Mapped[date | None]


class MeasurementStaffingPriorityMetric(Base, UUIDPrimaryKey):
    __tablename__ = "measurement_staffing_priority_metrics"

    measurement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("measurement_staffing.id", ondelete="CASCADE")
    )
    priority: Mapped[str]
    response_time_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    lead_time_days: Mapped[Decimal | None] = mapped_column(Numeric)
    avg_response_time_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    avg_lead_time_days: Mapped[Decimal | None] = mapped_column(Numeric)


class MeasurementTesting(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "measurement_testing"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    as_of_date: Mapped[date]

    total_test_cases_designed: Mapped[int | None]
    executed_test_cases: Mapped[int | None]
    passed_test_cases: Mapped[int | None]
    automated_test_cases: Mapped[int | None]
    effort_test_case_design: Mapped[Decimal | None] = mapped_column(Numeric)
    effort_test_execution: Mapped[Decimal | None] = mapped_column(Numeric)

    test_execution_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    test_pass_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    automation_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    test_design_productivity: Mapped[Decimal | None] = mapped_column(Numeric)
    test_execution_productivity: Mapped[Decimal | None] = mapped_column(Numeric)

    last_updated_date: Mapped[date | None]


class MeasurementCloudMaintenance(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "measurement_cloud_maintenance"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    as_of_date: Mapped[date]

    total_uptime_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    total_scheduled_time_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    application_downtime_hours: Mapped[Decimal | None] = mapped_column(Numeric)

    service_availability_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    application_availability_pct: Mapped[Decimal | None] = mapped_column(Numeric)

    last_updated_date: Mapped[date | None]


class MeasurementCloudMigration(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "measurement_cloud_migration"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    as_of_date: Mapped[date]

    planned_application_migration_count: Mapped[int | None]
    applications_migrated_count: Mapped[int | None]
    total_migration_attempts: Mapped[int | None]
    successful_migrations: Mapped[int | None]
    migration_start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    migration_end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    applications_migrated_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    migration_success_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    migration_downtime_minutes: Mapped[Decimal | None] = mapped_column(Numeric)

    last_updated_date: Mapped[date | None]
