"""Reporting hubs — build the per-period submission timeline behind the
progress rings and activity heatmaps.

- Project Reporting: Weekly + Monthly (GET /projects/{id}/reporting-activity).
- Account / Geo Status Reporting: Weekly only
  (GET /accounts/{id}/reporting-activity, GET /geos/{id}/reporting-activity).

One row per reporting period in the requested calendar year, each classified
against that scope's status reports, plus the rolled-up counts.

- "n/a"      — nothing was owed: the period starts before the project's start
               date, or after the reporting window closes (min of today and
               the project's end date). Shown as a plain box, excluded from
               the ring totals / percentage.
- "on-time"  — a Submitted/Approved report whose updated_at date is on or
               before the period end (updated_at stands in for submit time;
               deadline = period end, no grace — same rule as
               services/dashboard.py's _project_reporting_bucket).
- "late"     — a Submitted/Approved report updated after the period end.
- "pending"  — in the reporting window, started, no submitted report yet.
"""

from datetime import date, datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_status import ProjectStatusReport
from app.models.projects import Project
from app.models.reference_data import ReportingPeriod
from app.models.regional_status import AccountStatusReport, GeoStatusReport
from app.schemas.enums import ReportStatus
from app.schemas.reporting_activity import (
    ActivityCounts,
    PeriodActivityItem,
    PeriodActivityStatus,
    ReportingActivityResponse,
    ReportingActivitySeries,
    WeeklyReportingActivityResponse,
)

_SUBMITTED = (ReportStatus.SUBMITTED, ReportStatus.APPROVED)


class _StatusReportLike(Protocol):
    """The slice of a Project/Account/Geo status report row _classify needs."""

    id: UUID
    period_id: UUID
    status: str
    updated_at: datetime


def _classify(
    period: ReportingPeriod,
    report: _StatusReportLike | None,
    scope_start: date | None,
    window_end: date,
) -> PeriodActivityStatus:
    if scope_start is not None and period.start_date < scope_start:
        return "n/a"  # before the scope existed — no report was owed
    if period.start_date > window_end:
        return "n/a"  # future, or past the scope's end date — not owed
    if report is not None and report.status in _SUBMITTED:
        return "on-time" if report.updated_at.date() <= period.end_date else "late"
    return "pending"


def _series(
    periods: list[ReportingPeriod],
    by_period: dict[UUID, _StatusReportLike],
    scope_start: date | None,
    window_end: date,
) -> ReportingActivitySeries:
    items: list[PeriodActivityItem] = []
    on_time = late = pending = not_applicable = 0
    for period in sorted(periods, key=lambda p: p.start_date):
        report = by_period.get(period.id)
        status = _classify(period, report, scope_start, window_end)
        if status == "on-time":
            on_time += 1
        elif status == "late":
            late += 1
        elif status == "pending":
            pending += 1
        else:
            not_applicable += 1
        items.append(
            PeriodActivityItem(
                period_id=period.id,
                label=period.label,
                start_date=period.start_date,
                end_date=period.end_date,
                status=status,
                has_report=report is not None,
            )
        )

    submitted = on_time + late
    total = on_time + late + pending  # in-window periods only ("n/a" excluded)
    return ReportingActivitySeries(
        items=items,
        counts=ActivityCounts(
            on_time=on_time,
            late=late,
            pending=pending,
            not_applicable=not_applicable,
            submitted=submitted,
            total=total,
        ),
        pct=round(submitted / total * 100) if total else 0,
    )


async def _periods_in_year(
    db: AsyncSession, year: int, period_types: tuple[str, ...]
) -> list[ReportingPeriod]:
    return list(
        (
            await db.execute(
                select(ReportingPeriod).where(
                    ReportingPeriod.period_type.in_(period_types),
                    ReportingPeriod.start_date >= date(year, 1, 1),
                    ReportingPeriod.start_date <= date(year, 12, 31),
                )
            )
        )
        .scalars()
        .all()
    )


async def build_reporting_activity(
    db: AsyncSession, project_id: UUID, year: int
) -> ReportingActivityResponse:
    project_start = (
        await db.execute(
            select(func.coalesce(Project.actual_start_date, Project.planned_start_date)).where(
                Project.id == project_id
            )
        )
    ).scalar_one_or_none()
    project_end = (
        await db.execute(
            select(func.coalesce(Project.actual_end_date, Project.planned_end_date)).where(
                Project.id == project_id
            )
        )
    ).scalar_one_or_none()
    today = date.today()
    # Reporting stops at the current date, or the project's end date if it
    # finished earlier — periods that start beyond that are "n/a".
    window_end = min(today, project_end) if project_end is not None else today

    periods = await _periods_in_year(db, year, ("Weekly", "Monthly"))
    period_ids = [p.id for p in periods]
    reports: list[ProjectStatusReport] = []
    if period_ids:
        reports = list(
            (
                await db.execute(
                    select(ProjectStatusReport).where(
                        ProjectStatusReport.project_id == project_id,
                        ProjectStatusReport.period_id.in_(period_ids),
                    )
                )
            )
            .scalars()
            .all()
        )
    by_period = {r.period_id: r for r in reports}

    return ReportingActivityResponse(
        year=year,
        weekly=_series(
            [p for p in periods if p.period_type == "Weekly"], by_period, project_start, window_end
        ),
        monthly=_series(
            [p for p in periods if p.period_type == "Monthly"], by_period, project_start, window_end
        ),
    )


async def build_weekly_reporting_activity(
    db: AsyncSession, scope: str, scope_id: UUID, year: int
) -> WeeklyReportingActivityResponse:
    """Account / Geo Status Reporting — Weekly only, no scope start/end date
    (accounts and geos have no lifecycle), so the window closes at today."""
    report_model, fk_column = {
        "account": (AccountStatusReport, AccountStatusReport.account_id),
        "geo": (GeoStatusReport, GeoStatusReport.geo_id),
    }[scope]

    periods = await _periods_in_year(db, year, ("Weekly",))
    period_ids = [p.id for p in periods]
    reports: list[_StatusReportLike] = []
    if period_ids:
        reports = list(
            (
                await db.execute(
                    select(report_model).where(
                        fk_column == scope_id, report_model.period_id.in_(period_ids)
                    )
                )
            )
            .scalars()
            .all()
        )
    by_period = {r.period_id: r for r in reports}

    return WeeklyReportingActivityResponse(
        year=year,
        weekly=_series(periods, by_period, None, date.today()),
    )
