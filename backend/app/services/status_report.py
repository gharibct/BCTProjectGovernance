"""Shared helper: guarantee a project_status_reports row exists for a
(project, reporting period) pair.

The Project Dashboard (project-dashboard-view.tsx / reporting-hub.tsx) treats
the presence of this row as "reporting has started for this period" and shows
it as a Draft. The Project Status screen creates it explicitly on Save
Details; Measurement — the other period-scoped register — calls this on save
so entering measurement data alone still surfaces a Draft on the dashboard
instead of the period looking untouched.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.project_status import project_status_report_crud
from app.models.project_status import ProjectStatusReport
from app.schemas.enums import ReportStatus
from app.schemas.project_status import ProjectStatusReportCreate


async def ensure_draft_report(db: AsyncSession, project_id: UUID, period_id: UUID) -> None:
    """Create a Draft project_status_reports row for (project_id, period_id)
    if none exists yet.

    Idempotent — a no-op once any report is on file for the period, whatever
    its status, so it never resurrects or downgrades a Submitted/Approved
    report.
    """
    existing = (
        await db.execute(
            select(ProjectStatusReport.id).where(
                ProjectStatusReport.project_id == project_id,
                ProjectStatusReport.period_id == period_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return
    await project_status_report_crud.create(
        db,
        ProjectStatusReportCreate(period_id=period_id, status=ReportStatus.DRAFT),
        project_id=project_id,
    )
