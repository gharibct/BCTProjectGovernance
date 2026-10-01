"""Resource allocation of a project, read from the Oracle man-month tables.

A project is linked to Oracle through its `project_oracle_ids` (Map Oracle
Projects); each Oracle project number is looked up in `oracle_project_master`,
and the allocations of every mapped project are combined. The tables are filled by
services/man_month_import.py, one month per load.
"""

from calendar import monthrange
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oracle_man_month import (
    OracleEmployeeMaster,
    OracleProjectAllocation,
    OracleProjectMaster,
    OracleProjectMonthAllocation,
)
from app.models.projects import ProjectOracleId
from app.schemas.oracle_resource_allocation import (
    ResourceAllocationDetail,
    ResourceAllocationMonth,
    ResourceAllocationPeriod,
    ResourceAllocationRow,
    ResourceAllocationSummary,
)

_ZERO = Decimal("0")


async def oracle_master_ids(db: AsyncSession, project_id: UUID) -> list[UUID]:
    """oracle_project_master ids for the project's mapped Oracle project numbers."""
    rows = await db.execute(
        select(OracleProjectMaster.id)
        .join(ProjectOracleId, ProjectOracleId.oracle_project_id == OracleProjectMaster.project_number)
        .where(ProjectOracleId.project_id == project_id)
    )
    return list(rows.scalars().all())


def _month_bounds(today: date) -> tuple[date, date]:
    return today.replace(day=1), today.replace(day=monthrange(today.year, today.month)[1])


async def resource_allocation_summary(
    db: AsyncSession, project_id: UUID, today: date | None = None
) -> ResourceAllocationSummary:
    today = today or date.today()
    ids = await oracle_master_ids(db, project_id)
    if not ids:
        return ResourceAllocationSummary(resources_allocated_this_month=0, man_months_consumed=_ZERO)

    month_start, month_end = _month_bounds(today)
    resources = (
        await db.execute(
            select(func.count(func.distinct(OracleProjectAllocation.employee_id))).where(
                OracleProjectAllocation.project_id.in_(ids),
                OracleProjectAllocation.allocation_start_date <= month_end,
                (OracleProjectAllocation.allocation_end_date.is_(None))
                | (OracleProjectAllocation.allocation_end_date >= month_start),
            )
        )
    ).scalar_one()
    consumed = (
        await db.execute(
            select(func.coalesce(func.sum(OracleProjectMonthAllocation.man_month), 0)).where(
                OracleProjectMonthAllocation.project_id.in_(ids),
                OracleProjectMonthAllocation.month_start <= today,
            )
        )
    ).scalar_one()
    return ResourceAllocationSummary(resources_allocated_this_month=resources, man_months_consumed=Decimal(consumed))


def _like_pattern(search: str) -> str:
    escaped = search.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def list_resource_allocations(
    db: AsyncSession,
    project_id: UUID,
    *,
    search: str | None,
    skip: int,
    limit: int,
    scope: str | None = None,
    today: date | None = None,
) -> tuple[list[ResourceAllocationRow], int]:
    """One row per resource, ordered by name. `search` matches the name anywhere in it.

    `scope` splits the grid: "current" = resources with an allocation overlapping
    the current month (the "Resources Allocated This Month" definition), "old" =
    every other resource on the project; omitted = all."""
    ids = await oracle_master_ids(db, project_id)
    if not ids:
        return [], 0

    filters = [OracleProjectAllocation.project_id.in_(ids)]
    if search and search.strip():
        filters.append(func.lower(OracleEmployeeMaster.name).like(_like_pattern(search), escape="\\"))

    if scope in ("current", "old"):
        month_start, month_end = _month_bounds(today or date.today())
        current_employees = select(OracleProjectAllocation.employee_id).where(
            OracleProjectAllocation.project_id.in_(ids),
            OracleProjectAllocation.allocation_start_date <= month_end,
            (OracleProjectAllocation.allocation_end_date.is_(None))
            | (OracleProjectAllocation.allocation_end_date >= month_start),
        )
        filters.append(
            OracleProjectAllocation.employee_id.in_(current_employees)
            if scope == "current"
            else OracleProjectAllocation.employee_id.not_in(current_employees)
        )

    base = (
        select(
            OracleEmployeeMaster.id,
            OracleEmployeeMaster.name,
            OracleEmployeeMaster.employee_number,
            OracleEmployeeMaster.location,
            func.min(OracleProjectAllocation.allocation_start_date),
            func.max(OracleProjectAllocation.allocation_end_date),
            func.count(OracleProjectAllocation.id),
            func.count(OracleProjectAllocation.allocation_end_date),
        )
        .join(OracleEmployeeMaster, OracleEmployeeMaster.id == OracleProjectAllocation.employee_id)
        .where(*filters)
        .group_by(
            OracleEmployeeMaster.id,
            OracleEmployeeMaster.name,
            OracleEmployeeMaster.employee_number,
            OracleEmployeeMaster.location,
        )
    )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    page = (
        await db.execute(
            base.order_by(OracleEmployeeMaster.name, OracleEmployeeMaster.employee_number).offset(skip).limit(limit)
        )
    ).all()

    employee_ids = [row[0] for row in page]
    man_months: dict[UUID, Decimal] = {}
    if employee_ids:
        sums = await db.execute(
            select(OracleProjectMonthAllocation.employee_id, func.sum(OracleProjectMonthAllocation.man_month))
            .where(
                OracleProjectMonthAllocation.project_id.in_(ids),
                OracleProjectMonthAllocation.employee_id.in_(employee_ids),
            )
            .group_by(OracleProjectMonthAllocation.employee_id)
        )
        man_months = {employee_id: Decimal(total_mm) for employee_id, total_mm in sums.all()}

    oracle_ids: dict[UUID, list[str]] = {}
    if employee_ids:
        numbers = await db.execute(
            select(OracleProjectAllocation.employee_id, OracleProjectMaster.project_number)
            .join(OracleProjectMaster, OracleProjectMaster.id == OracleProjectAllocation.project_id)
            .where(
                OracleProjectAllocation.project_id.in_(ids),
                OracleProjectAllocation.employee_id.in_(employee_ids),
            )
            .distinct()
            .order_by(OracleProjectMaster.project_number)
        )
        for employee_id, project_number in numbers.all():
            oracle_ids.setdefault(employee_id, []).append(project_number)

    rows = [
        ResourceAllocationRow(
            employee_id=emp_id,
            employee_name=name,
            employee_code=code,
            location=location,
            oracle_project_ids=oracle_ids.get(emp_id, []),
            allocation_start_date=start,
            # An open-ended period (no end date) makes the whole span open-ended.
            allocation_end_date=end if n_end == n_periods else None,
            total_man_months=man_months.get(emp_id, _ZERO),
        )
        for emp_id, name, code, location, start, end, n_periods, n_end in page
    ]
    return rows, total


async def resource_allocation_detail(
    db: AsyncSession, project_id: UUID, employee_id: UUID
) -> ResourceAllocationDetail | None:
    """Month-wise allocation of one resource, or None if they aren't on the project."""
    ids = await oracle_master_ids(db, project_id)
    employee = await db.get(OracleEmployeeMaster, employee_id)
    if not ids or employee is None:
        return None

    periods = (
        await db.execute(
            select(OracleProjectAllocation)
            .where(OracleProjectAllocation.project_id.in_(ids), OracleProjectAllocation.employee_id == employee_id)
            .order_by(OracleProjectAllocation.allocation_start_date)
        )
    ).scalars().all()
    if not periods:
        return None

    # A month can hold several allocation periods (e.g. 0.97 + 0.03) or come from
    # several mapped Oracle projects, so months are summed per calendar month.
    months = (
        await db.execute(
            select(
                OracleProjectMonthAllocation.month_start,
                func.max(OracleProjectMonthAllocation.month),
                func.sum(OracleProjectMonthAllocation.man_month),
            )
            .where(
                OracleProjectMonthAllocation.project_id.in_(ids),
                OracleProjectMonthAllocation.employee_id == employee_id,
            )
            .group_by(OracleProjectMonthAllocation.month_start)
            .order_by(OracleProjectMonthAllocation.month_start)
        )
    ).all()
    month_rows = [
        ResourceAllocationMonth(month=label, month_start=month_start, man_month=Decimal(value))
        for month_start, label, value in months
    ]
    return ResourceAllocationDetail(
        employee_id=employee.id,
        employee_name=employee.name,
        employee_code=employee.employee_number,
        location=employee.location,
        periods=[
            ResourceAllocationPeriod(
                allocation_start_date=p.allocation_start_date,
                allocation_end_date=p.allocation_end_date,
                percentage_allocation=p.percentage_allocation,
            )
            for p in periods
        ],
        months=month_rows,
        total_man_months=sum((m.man_month for m in month_rows), _ZERO),
    )
