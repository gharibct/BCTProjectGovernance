from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.db import get_db
from app.models.reference_data import ReportingPeriod
from app.schemas.enums import PeriodType, RoleCode
from app.schemas.reference_data import (
    ReportingPeriodDueDateUpdate,
    ReportingPeriodGenerate,
    ReportingPeriodGenerateResult,
    ReportingPeriodRead,
)

# Admin screen for the Weekly / Monthly reporting periods: generate a calendar
# year's periods and adjust a period's due date. Plain create/edit of a period
# also exists on the generic /reporting-periods CRUD router.
router = APIRouter(prefix="/admin/reporting-periods", tags=["Reference Data"])

_admin = [Depends(require_role(RoleCode.ADMIN))]

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def weekly_due_date(end_date: date) -> date:
    """The first Tuesday after the period's end date (a Friday -> +4 days)."""
    return end_date + timedelta(days=(1 - end_date.weekday()) % 7 or 7)


def monthly_due_date(end_date: date) -> date:
    """The 7th of the month following the period's end."""
    first_next = (end_date.replace(day=1) + timedelta(days=32)).replace(day=1)
    return first_next.replace(day=7)


@router.get("", response_model=list[ReportingPeriodRead], dependencies=_admin)
async def list_periods_for_year(year: int = Query(ge=2000, le=2100), db: AsyncSession = Depends(get_db)):
    """Weekly and Monthly periods of a year (a period belongs to the year in its code)."""
    rows = (
        await db.execute(
            select(ReportingPeriod)
            .where(
                ReportingPeriod.period_type.in_([PeriodType.WEEKLY, PeriodType.MONTHLY]),
                ReportingPeriod.code.like(f"{year}-%"),
            )
            .order_by(ReportingPeriod.period_type.desc(), ReportingPeriod.start_date)
        )
    ).scalars()
    return list(rows)


@router.post("/generate", response_model=ReportingPeriodGenerateResult, dependencies=_admin)
async def generate_periods(payload: ReportingPeriodGenerate, db: AsyncSession = Depends(get_db)):
    """Create the year's missing periods. Weekly: ISO weeks, Monday-Friday, due the
    following Tuesday. Monthly: calendar months, due on the 7th of the next month.
    Existing periods (and their edited due dates) are left untouched."""
    year = payload.year
    existing = set(
        (
            await db.execute(
                select(ReportingPeriod.code).where(ReportingPeriod.code.like(f"{year}-%"))
            )
        ).scalars()
    )
    now = datetime.now(UTC)
    weekly = monthly = 0

    # ISO week 1 contains Jan 4th; walk Mondays while they still belong to the ISO year.
    monday = date(year, 1, 4) - timedelta(days=date(year, 1, 4).weekday())
    while monday.isocalendar().year == year:
        iso_week = monday.isocalendar().week
        code = f"{year}-W{iso_week:02d}"
        if code not in existing:
            friday = monday + timedelta(days=4)
            db.add(
                ReportingPeriod(
                    id=uuid4(),
                    period_type=PeriodType.WEEKLY,
                    code=code,
                    label=f"{_MONTHS[friday.month - 1]} {friday.day:02d}, {friday.year}",
                    start_date=monday,
                    end_date=friday,
                    due_date=weekly_due_date(friday),
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
            )
            weekly += 1
        monday += timedelta(days=7)

    for month in range(1, 13):
        code = f"{year}-{month:02d}"
        if code in existing:
            continue
        first = date(year, month, 1)
        last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        db.add(
            ReportingPeriod(
                id=uuid4(),
                period_type=PeriodType.MONTHLY,
                code=code,
                label=f"{_MONTHS[month - 1]} {year}",
                start_date=first,
                end_date=last,
                due_date=monthly_due_date(last),
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
        monthly += 1

    await db.flush()
    return ReportingPeriodGenerateResult(year=year, weekly_created=weekly, monthly_created=monthly)


@router.put("/{period_id}/due-date", response_model=ReportingPeriodRead, dependencies=_admin)
async def update_due_date(period_id: UUID, payload: ReportingPeriodDueDateUpdate, db: AsyncSession = Depends(get_db)):
    period = await db.get(ReportingPeriod, period_id)
    if period is None or period.period_type not in (PeriodType.WEEKLY, PeriodType.MONTHLY):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reporting period not found")
    if payload.due_date < period.end_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Due date cannot be before the period's end date")
    period.due_date = payload.due_date
    period.updated_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(period)
    return period
