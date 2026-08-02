from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.crud.project_status import project_status_report_crud
from app.models.project_status import ProjectStatusReport
from app.schemas.project_status import (
    ProjectStatusReportCreate,
    ProjectStatusReportRead,
    ProjectStatusReportUpdate,
)

# Weekly history (UX §4.4 / §7 items 2-3): list (date-sorted) + get-by-date +
# create + edit-while-current. No delete — reports are a retained audit trail.
router = APIRouter(prefix="/projects/{project_id}/status-reports", tags=["Project Status"])


@router.get("", response_model=list[ProjectStatusReportRead])
async def list_status_reports(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_status_report_crud.list(
        db,
        filters={ProjectStatusReport.project_id: project_id},
        order_by=desc(ProjectStatusReport.report_date),
        limit=200,
    )
    return items


@router.get("/latest", response_model=ProjectStatusReportRead)
async def get_latest_status_report(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_status_report_crud.list(
        db,
        filters={ProjectStatusReport.project_id: project_id},
        order_by=desc(ProjectStatusReport.report_date),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No status reports recorded for this project")
    return items[0]


@router.get("/{report_date}", response_model=ProjectStatusReportRead)
async def get_status_report_by_date(project_id: UUID, report_date: date, db: AsyncSession = Depends(get_db)):
    items, _ = await project_status_report_crud.list(
        db,
        filters={
            ProjectStatusReport.project_id: project_id,
            ProjectStatusReport.report_date: report_date,
        },
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No status report for that date")
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
