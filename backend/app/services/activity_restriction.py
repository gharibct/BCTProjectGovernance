"""Per-project activity restrictions.

From `not_required_from`, a project no longer owes (or accepts) an activity —
see db/tables/58_project_activity_restrictions.sql. There is at most one row per
(project, activity); it is set once and never re-opened.

Report-type activities are restricted for reporting periods that START on or
after the date. Everything without a period (DE assessments, DE findings, the
contractual registers, event-based measurements) is compared with the record's
own date, or today when it has none.

Weekly reporting periods map to DELIVERY_STATUS; the monthly Project
Performance report is made of three sections — METRICS, COMMITMENTS and
PAYMENT_MILESTONES — and the report as a whole is only "not required" once all
three are restricted.
"""

from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.projects import ProjectActivityRestriction
from app.models.reference_data import ReportingPeriod
from app.schemas.enums import ProjectActivity

ACTIVITY_LABEL: dict[str, str] = {
    ProjectActivity.DELIVERY_STATUS: "Delivery Status reporting",
    ProjectActivity.METRICS: "Project Performance - Metrics",
    ProjectActivity.COMMITMENTS: "Project Performance - Contractual Commitments",
    ProjectActivity.PAYMENT_MILESTONES: "Project Performance - Payment Milestones",
    ProjectActivity.DE_ASSESSMENT: "DE Assessment",
}

MONTHLY_ACTIVITIES: tuple[ProjectActivity, ...] = (
    ProjectActivity.METRICS,
    ProjectActivity.COMMITMENTS,
    ProjectActivity.PAYMENT_MILESTONES,
)


async def restrictions_for_project(db: AsyncSession, project_id: UUID) -> dict[str, date]:
    """activity -> not_required_from for one project."""
    rows = (
        await db.execute(
            select(ProjectActivityRestriction.activity, ProjectActivityRestriction.not_required_from).where(
                ProjectActivityRestriction.project_id == project_id
            )
        )
    ).all()
    return {activity: not_required_from for activity, not_required_from in rows}


async def restricted_from_by_project(
    db: AsyncSession, project_ids: list[UUID], *activities: ProjectActivity
) -> dict[UUID, date]:
    """project id -> the date from which ALL the given activities are restricted
    (the latest of their dates). Projects missing any of them are absent."""
    if not project_ids or not activities:
        return {}
    rows = (
        await db.execute(
            select(
                ProjectActivityRestriction.project_id,
                ProjectActivityRestriction.activity,
                ProjectActivityRestriction.not_required_from,
            ).where(
                ProjectActivityRestriction.project_id.in_(project_ids),
                ProjectActivityRestriction.activity.in_([a.value for a in activities]),
            )
        )
    ).all()
    per_project: dict[UUID, dict[str, date]] = {}
    for project_id, activity, not_required_from in rows:
        per_project.setdefault(project_id, {})[activity] = not_required_from
    wanted = {a.value for a in activities}
    return {
        project_id: max(dates.values()) for project_id, dates in per_project.items() if wanted <= set(dates)
    }


def is_restricted(restrictions: dict[str, date], activity: ProjectActivity, on_date: date) -> bool:
    not_required_from = restrictions.get(activity.value)
    return not_required_from is not None and on_date >= not_required_from


def _blocked(activity: ProjectActivity, not_required_from: date) -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT,
        f"{ACTIVITY_LABEL[activity]} is not required for this project from "
        f"{not_required_from.isoformat()}, so it can no longer be recorded.",
    )


async def assert_activity_open(db: AsyncSession, project_id: UUID, activity: ProjectActivity, on_date: date) -> None:
    """409 when `activity` is restricted for `project_id` on `on_date`."""
    restrictions = await restrictions_for_project(db, project_id)
    if is_restricted(restrictions, activity, on_date):
        raise _blocked(activity, restrictions[activity.value])


async def assert_period_open(
    db: AsyncSession, project_id: UUID, period_id: UUID | None, *, activity: ProjectActivity | None = None
) -> None:
    """409 when the reporting period's report is no longer required.

    Weekly period -> DELIVERY_STATUS. Monthly period -> `activity` when given
    (a Performance section), otherwise the monthly report as a whole, which is
    only blocked once all three sections are restricted."""
    if period_id is None:
        return
    period = await db.get(ReportingPeriod, period_id)
    if period is None or period.period_type not in ("Weekly", "Monthly"):
        return
    restrictions = await restrictions_for_project(db, project_id)
    if not restrictions:
        return
    if period.period_type == "Weekly":
        required = ProjectActivity.DELIVERY_STATUS
        if is_restricted(restrictions, required, period.start_date):
            raise _blocked(required, restrictions[required.value])
        return
    if activity is not None:
        if is_restricted(restrictions, activity, period.start_date):
            raise _blocked(activity, restrictions[activity.value])
        return
    if all(is_restricted(restrictions, a, period.start_date) for a in MONTHLY_ACTIVITIES):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The monthly Project Performance report is not required for this project from "
            f"{max(restrictions[a.value] for a in MONTHLY_ACTIVITIES).isoformat()}.",
        )
