import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey

# Oracle "BCT Man Month Report" integration (see app/services/man_month_import.py).
# One month of the report is loaded at a time (the month before the load date):
# every source row lands in `integration_man_month`, then four tables are derived
# from it: employee master, project master, project allocation (one row per
# allocation period, with its start/end date) and project month allocation (the
# man-month of an allocation in a month).
# `month` is the display label ("Aug-26"); `month_start` is the same month as a
# date (2026-08-01) for sorting and joins.


class IntegrationLoadRun(Base, UUIDPrimaryKey):
    __tablename__ = "integration_load_run"

    source_name: Mapped[str]  # BCT_MAN_MONTH
    source_file: Mapped[str]
    month: Mapped[str]
    month_start: Mapped[date]
    status: Mapped[str]  # SUCCESS | FAILED
    rows_read: Mapped[int]
    rows_loaded: Mapped[int]
    rows_skipped: Mapped[int]
    employees_inserted: Mapped[int]
    employees_updated: Mapped[int]
    projects_inserted: Mapped[int]
    projects_updated: Mapped[int]
    project_allocations_inserted: Mapped[int]
    project_allocations_updated: Mapped[int]
    allocations_written: Mapped[int]  # month allocations
    allocations_removed: Mapped[int]  # month allocations
    error: Mapped[str | None]
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IntegrationManMonth(Base, UUIDPrimaryKey):
    __tablename__ = "integration_man_month"
    __table_args__ = (
        Index("idx_integration_man_month_month", "month_start"),
        Index("idx_integration_man_month_employee", "employee_number"),
        Index("idx_integration_man_month_project", "project_number"),
    )

    load_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("integration_load_run.id", ondelete="CASCADE")
    )
    source_row_no: Mapped[int]  # Excel row number, for traceability
    month: Mapped[str]
    month_start: Mapped[date]
    man_month: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))

    employee_geo: Mapped[str | None]
    operating_unit: Mapped[str | None]
    account_name: Mapped[str | None]

    employee_number: Mapped[str]
    name: Mapped[str | None]
    employment_type: Mapped[str | None]
    designation: Mapped[str | None]
    grade: Mapped[str | None]
    department: Mapped[str | None]
    doj: Mapped[date | None]
    termination_date: Mapped[date | None]
    location: Mapped[str | None]

    project_number: Mapped[str]
    project_name: Mapped[str]
    project_type: Mapped[str | None]
    project_ou: Mapped[str | None]
    project_geo: Mapped[str | None]
    project_start_date: Mapped[date | None]
    project_end_date: Mapped[date | None]
    project_sbu_code: Mapped[str | None]
    project_sbu_name: Mapped[str | None]
    project_practice: Mapped[str | None]

    # `role` is kept only here; the allocation dates tell apart the several rows a
    # single employee can have on one project (e.g. 0.97 from Aug + 0.03 to Jul).
    role: Mapped[str | None]
    percentage_allocation: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    allocation_start_date: Mapped[date | None]
    allocation_end_date: Mapped[date | None]

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OracleEmployeeMaster(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "oracle_employee_master"

    employee_number: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str | None]
    employment_type: Mapped[str | None]
    designation: Mapped[str | None]
    grade: Mapped[str | None]
    department: Mapped[str | None]
    employee_geo: Mapped[str | None]
    operating_unit: Mapped[str | None]
    doj: Mapped[date | None]
    termination_date: Mapped[date | None]
    location: Mapped[str | None]
    first_seen_month: Mapped[date]
    last_seen_month: Mapped[date]
    last_load_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("integration_load_run.id"))


class OracleProjectMaster(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "oracle_project_master"

    project_number: Mapped[str] = mapped_column(unique=True)
    project_name: Mapped[str]
    account_name: Mapped[str | None]
    project_type: Mapped[str | None]
    project_ou: Mapped[str | None]
    project_geo: Mapped[str | None]
    project_start_date: Mapped[date | None]
    project_end_date: Mapped[date | None]
    project_sbu_code: Mapped[str | None]
    project_sbu_name: Mapped[str | None]
    project_practice: Mapped[str | None]
    # Region / GEO the project's `project_geo` ("BCT US") resolves to, set by the
    # import (services/oracle_project_profile.match_region). NULL when it doesn't
    # match exactly one active region.
    region_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("regions.id"))
    geo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("geos.id"))
    first_seen_month: Mapped[date]
    last_seen_month: Mapped[date]
    last_load_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("integration_load_run.id"))


class OracleProjectAllocation(Base, UUIDPrimaryKey, TimestampColumns):
    """One allocation period of an employee on a project. Rows that later drop out
    of the report are kept (history); `last_seen_month` says when it last appeared."""

    __tablename__ = "oracle_project_allocation"
    __table_args__ = (
        UniqueConstraint("employee_id", "project_id", "allocation_start_date"),
        Index("idx_oracle_project_allocation_project", "project_id"),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("oracle_employee_master.id", ondelete="CASCADE")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("oracle_project_master.id", ondelete="CASCADE")
    )
    percentage_allocation: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    allocation_start_date: Mapped[date]
    allocation_end_date: Mapped[date | None]
    first_seen_month: Mapped[date]
    last_seen_month: Mapped[date]
    last_load_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("integration_load_run.id"))


class OracleProjectMonthAllocation(Base, UUIDPrimaryKey, TimestampColumns):
    """The man-month of one allocation in one month (no row when the report is blank)."""

    __tablename__ = "oracle_project_month_allocation"
    __table_args__ = (
        UniqueConstraint("allocation_id", "month_start"),
        Index("idx_oracle_project_month_allocation_month", "month_start"),
        Index("idx_oracle_project_month_allocation_project", "project_id", "month_start"),
    )

    allocation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("oracle_project_allocation.id", ondelete="CASCADE")
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("oracle_employee_master.id", ondelete="CASCADE")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("oracle_project_master.id", ondelete="CASCADE")
    )
    month: Mapped[str]
    month_start: Mapped[date]
    man_month: Mapped[Decimal] = mapped_column(Numeric(8, 4))
    last_load_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("integration_load_run.id"))
