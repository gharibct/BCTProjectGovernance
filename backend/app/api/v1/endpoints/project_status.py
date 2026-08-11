from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.crud.project_status import project_status_report_crud
from app.models.project_status import ProjectStatusReport
from app.models.reference_data import ReportingPeriod
from app.schemas.project_status import (
    ProjectStatusReportCreate,
    ProjectStatusReportRead,
    ProjectStatusReportUpdate,
)

# Weekly/Monthly history (UX §4.4 / §7 items 2-3): list (period-sorted) +
# latest + create + edit. No delete — reports are a retained audit trail.
router = APIRouter(prefix="/projects/{project_id}/status-reports", tags=["Project Status"])


# Reports are keyed off a reporting_periods row rather than a raw date (see
# db/tables/05_project_status_reports.sql), so ordering has to sort by that
# period's start_date via a correlated subquery — same pattern as
# measurement.py's _by_period_start.
def _by_period_start(model: type) -> Any:
    return (
        select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()
    )


@router.get("", response_model=list[ProjectStatusReportRead])
async def list_status_reports(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_status_report_crud.list(
        db,
        filters={ProjectStatusReport.project_id: project_id},
        order_by=_by_period_start(ProjectStatusReport),
        limit=200,
    )
    return items


@router.get("/latest", response_model=ProjectStatusReportRead)
async def get_latest_status_report(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_status_report_crud.list(
        db,
        filters={ProjectStatusReport.project_id: project_id},
        order_by=_by_period_start(ProjectStatusReport),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No status reports recorded for this project")
    return items[0]


@router.post("", response_model=ProjectStatusReportRead, status_code=status.HTTP_201_CREATED)
async def create_status_report(
    project_id: UUID,
    payload: ProjectStatusReportCreate,
    db: AsyncSession = Depends(get_db),
):
    return await project_status_report_crud.create(db, payload, project_id=project_id)


@router.put("/{report_id}", response_model=ProjectStatusReportRead)
async def update_status_report(
    project_id: UUID,
    report_id: UUID,
    payload: ProjectStatusReportUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await project_status_report_crud.get(db, report_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    return await project_status_report_crud.update(db, obj, payload)
