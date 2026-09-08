"""Time-based notification scans — the periodic counterpart to the inline
`notify()` calls in the request handlers.

Each `scan_*` coroutine takes a live `AsyncSession`, emits notifications via
`services.notifications.notify()` with a stable `dedupe_key`, and returns the
count it created. `run_all_scans()` opens one `AsyncSessionLocal`, runs all
three, and commits once — this is what the APScheduler job calls.

Idempotency is entirely `dedupe_key` + `notify()`'s existence check: re-running
a scan the same day (or after a restart) creates nothing new.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.models.actions import Action
from app.models.de_assessment import DEAssessment
from app.models.project_status import ProjectStatusReport
from app.models.projects import Project
from app.models.reference_data import ReportingPeriod
from app.schemas.enums import ActionStatus, ProjectStatus, ReportStatus
from app.services import notifications as notify_svc

# Actions within this many days of their due date (or already past) are surfaced.
_ACTION_DUE_WINDOW_DAYS = 2

_SUBMITTED_REPORT_STATUSES = (ReportStatus.SUBMITTED, ReportStatus.APPROVED)
_LIVE_ACTION_STATUSES = (ActionStatus.OPEN, ActionStatus.IN_PROGRESS)


async def scan_overdue_assessments(db: AsyncSession) -> int:
    """Projects whose latest DE assessment's `next_assessment_due_date` has
    passed → notify the allocated Delivery Excellence."""
    today = date.today()
    assessments = (await db.execute(select(DEAssessment))).scalars().all()
    latest: dict = {}
    for a in assessments:
        current = latest.get(a.project_id)
        if current is None or (a.assessment_date or date.min) > (current.assessment_date or date.min):
            latest[a.project_id] = a

    overdue_project_ids = [
        pid
        for pid, a in latest.items()
        if a.next_assessment_due_date is not None and a.next_assessment_due_date < today
    ]
    if not overdue_project_ids:
        return 0

    projects = (
        await db.execute(select(Project).where(Project.id.in_(overdue_project_ids)))
    ).scalars().all()

    created = 0
    for project in projects:
        due = latest[project.id].next_assessment_due_date
        row = await notify_svc.notify(
            db,
            recipient_id=project.delivery_excellence_id,
            type="ASSESSMENT_OVERDUE",
            title=f"DE assessment overdue for {project.project_code}",
            body=f"Next assessment was due {due.isoformat()}.",
            link=f"/de-assessment/{project.id}",
            entity_type="project",
            entity_id=project.id,
            data={"project_code": project.project_code, "due_date": due.isoformat()},
            dedupe_key=f"assessment-overdue:{project.id}:{due.isoformat()}",
        )
        if row is not None:
            created += 1
    return created


async def scan_report_defaulters(db: AsyncSession) -> int:
    """Each (approved project, ended active reporting period) pair with no
    Submitted/Approved status report → notify the project's PM. Only periods
    that begin on/after the project's effective start date count."""
    today = date.today()
    periods = (
        await db.execute(select(ReportingPeriod).where(ReportingPeriod.is_active.is_(True)))
    ).scalars().all()
    ended_periods = [p for p in periods if p.end_date is not None and p.end_date < today]
    if not ended_periods:
        return 0

    projects = (
        await db.execute(
            select(Project).where(
                Project.project_manager_id.is_not(None),
                Project.project_status == ProjectStatus.APPROVED,
            )
        )
    ).scalars().all()
    if not projects:
        return 0

    project_ids = [p.id for p in projects]
    period_ids = [p.id for p in ended_periods]
    reports = (
        await db.execute(
            select(ProjectStatusReport).where(
                ProjectStatusReport.project_id.in_(project_ids),
                ProjectStatusReport.period_id.in_(period_ids),
            )
        )
    ).scalars().all()
    submitted = {
        (r.project_id, r.period_id)
        for r in reports
        if r.status in _SUBMITTED_REPORT_STATUSES
    }

    created = 0
    for project in projects:
        project_start = project.tool_effective_date or project.actual_start_date or project.planned_start_date
        for period in ended_periods:
            if project_start is not None and period.start_date < project_start:
                continue
            if (project.id, period.id) in submitted:
                continue
            row = await notify_svc.notify(
                db,
                recipient_id=project.project_manager_id,
                type="REPORT_DEFAULTER",
                title=f"Status report missing for {project.project_code}",
                body=f"The {period.label} reporting period has ended without a submitted report.",
                link=f"/project-reporting/{project.id}/dashboard",
                entity_type="project",
                entity_id=project.id,
                data={"project_code": project.project_code, "period_id": str(period.id)},
                dedupe_key=f"report-defaulter:{project.id}:{period.id}",
            )
            if row is not None:
                created += 1
    return created


async def scan_actions_due(db: AsyncSession) -> int:
    """Open / In Progress actions due within the next `_ACTION_DUE_WINDOW_DAYS`
    days (or already overdue) → notify the assignee."""
    cutoff = date.today() + timedelta(days=_ACTION_DUE_WINDOW_DAYS)
    actions = (
        await db.execute(
            select(Action).where(
                Action.status.in_(_LIVE_ACTION_STATUSES),
                Action.due_date <= cutoff,
            )
        )
    ).scalars().all()

    created = 0
    for action in actions:
        overdue = action.due_date < date.today()
        row = await notify_svc.notify(
            db,
            recipient_id=action.action_by_id,
            type="ACTION_DUE",
            title=(
                f"Action {action.action_code} is overdue"
                if overdue
                else f"Action {action.action_code} is due soon"
            ),
            body=f"{action.title} — due {action.due_date.isoformat()}",
            link="/action-tracker",
            entity_type="action",
            entity_id=action.id,
            data={"action_code": action.action_code, "due_date": action.due_date.isoformat()},
            dedupe_key=f"action-due:{action.id}:{action.due_date.isoformat()}",
        )
        if row is not None:
            created += 1
    return created


async def run_all_scans() -> dict[str, int]:
    """Open one session, run every scan, commit once. The APScheduler entry point."""
    async with AsyncSessionLocal() as db:
        result = {
            "assessments_overdue": await scan_overdue_assessments(db),
            "report_defaulters": await scan_report_defaulters(db),
            "actions_due": await scan_actions_due(db),
        }
        await db.commit()
    return result
