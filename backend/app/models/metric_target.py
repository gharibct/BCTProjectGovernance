import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class MetricTargetDevelopment(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "metric_target_development"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)

    target_size_unit: Mapped[str | None] = mapped_column(Text)
    target_overall_planned_size: Mapped[Decimal | None] = mapped_column(Numeric)
    target_overall_estimated_effort: Mapped[Decimal | None] = mapped_column(Numeric)

    target_productivity: Mapped[Decimal | None] = mapped_column(Numeric)
    target_effort_variation_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_schedule_performance_index: Mapped[Decimal | None] = mapped_column(Numeric)
    target_cost_performance_index: Mapped[Decimal | None] = mapped_column(Numeric)
    target_defect_leakage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_code_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_test_execution_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_test_pass_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric)


class MetricTargetSupport(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "metric_target_support"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)

    target_incident_mttr_p1_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    target_incident_mttr_p2_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    target_incident_mttr_p3_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    target_service_request_mttr_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    target_user_clarification_mttr_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    target_incident_sla_compliance_p1_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_incident_sla_compliance_p2_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_incident_sla_compliance_p3_pct: Mapped[Decimal | None] = mapped_column(Numeric)


class MetricTargetStaffing(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "metric_target_staffing"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)

    target_pct_profiles_qualifying: Mapped[Decimal | None] = mapped_column(Numeric)
    target_pct_candidates_joining: Mapped[Decimal | None] = mapped_column(Numeric)


class MetricTargetStaffingPriority(Base, UUIDPrimaryKey):
    __tablename__ = "metric_target_staffing_priority"

    metric_target_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("metric_target_staffing.id", ondelete="CASCADE")
    )
    priority: Mapped[str]
    target_avg_response_time_hours: Mapped[Decimal | None] = mapped_column(Numeric)
    target_avg_lead_time_days: Mapped[Decimal | None] = mapped_column(Numeric)


class MetricTargetTesting(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "metric_target_testing"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)

    target_test_execution_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_test_pass_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_automation_coverage_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_test_design_productivity: Mapped[Decimal | None] = mapped_column(Numeric)
    target_test_execution_productivity: Mapped[Decimal | None] = mapped_column(Numeric)


class MetricTargetConsulting(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "metric_target_consulting"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)

    target_effort_variation_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_schedule_performance_index: Mapped[Decimal | None] = mapped_column(Numeric)
    target_cost_performance_index: Mapped[Decimal | None] = mapped_column(Numeric)


class MetricTargetCloudMaintenance(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "metric_target_cloud_maintenance"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)

    target_service_availability_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_application_availability_pct: Mapped[Decimal | None] = mapped_column(Numeric)


class MetricTargetCloudMigration(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "metric_target_cloud_migration"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)

    target_applications_migrated_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_migration_success_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric)
    target_migration_downtime_hours: Mapped[Decimal | None] = mapped_column(Numeric)
