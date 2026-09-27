"""Schemas for the project "Resource Allocation" page (Project Setup / Amend
Project): the Oracle man-month allocations of the project's mapped Oracle projects."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ResourceAllocationSummary(BaseModel):
    # Distinct resources whose allocation overlaps the current calendar month.
    resources_allocated_this_month: int
    # Man-months allocated across every loaded month up to today.
    man_months_consumed: Decimal


class ResourceAllocationRow(BaseModel):
    """One resource on the project (an employee can hold several allocation
    periods; the row spans them)."""

    employee_id: UUID
    employee_name: str | None = None
    employee_code: str
    location: str | None = None
    allocation_start_date: date | None = None  # earliest start
    allocation_end_date: date | None = None  # latest end; None when any period is open-ended
    total_man_months: Decimal


class ResourceAllocationMonth(BaseModel):
    month: str  # "Aug-26"
    month_start: date
    man_month: Decimal


class ResourceAllocationPeriod(BaseModel):
    allocation_start_date: date
    allocation_end_date: date | None = None
    percentage_allocation: Decimal | None = None


class ResourceAllocationDetail(BaseModel):
    """Month-wise allocation of one resource on the project (the drawer)."""

    employee_id: UUID
    employee_name: str | None = None
    employee_code: str
    location: str | None = None
    periods: list[ResourceAllocationPeriod]
    months: list[ResourceAllocationMonth]
    total_man_months: Decimal
