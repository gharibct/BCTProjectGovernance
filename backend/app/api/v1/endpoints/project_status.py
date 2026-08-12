from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.crud.project_status import project_status_item_crud, project_status_report_crud
from app.models.project_status import ProjectStatusItem, ProjectStatusReport
from app.models.reference_data import ReportingPeriod
from app.schemas.enums import ProjectStatusCategory, ReportStatus
from app.schemas.project_status import (
    ProjectStatusItemCreate,
    ProjectStatusItemRead,
    ProjectStatusItemRollupStatusUpdate,
    ProjectStatusItemUpdate,
    ProjectStatusReportCreate,
    ProjectStatusReportRead,
    ProjectStatusReportUpdate,
)
from app.schemas.status_review import StatusReportReviewRequest

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


# Review/sign-off (Project Review, for Account Heads): a Submitted report
# transitions to Approved/Rejected by the level above. Direct field
# assignment rather than CRUDBase.update since it needs the status-transition
# guard and a server-set reviewed_at timestamp.
@router.patch("/{report_id}/review", response_model=ProjectStatusReportRead)
async def review_status_report(
    project_id: UUID,
    report_id: UUID,
    payload: StatusReportReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    obj = await project_status_report_crud.get(db, report_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    if obj.status != ReportStatus.SUBMITTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only Submitted reports can be reviewed")

    obj.status = payload.decision
    obj.reviewed_by = payload.reviewed_by
    obj.reviewed_at = datetime.now(UTC)
    obj.review_comment = payload.comment
    await db.flush()
    await db.refresh(obj)
    return obj


# Project Status grids (redesign of the 3 free-text sections above, plus a
# new 4th "Key Risks / Issues" section, into per-category add/edit/delete
# registers — see db/tables/35_project_status_items.sql). Same hand-rolled
# shape as contractual.py's milestones_router (no business-code generation
# needed).
items_router = APIRouter(prefix="/projects/{project_id}/status-items", tags=["Project Status"])


@items_router.get("", response_model=list[ProjectStatusItemRead])
async def list_status_items(
    project_id: UUID,
    period_id: UUID,
    category: ProjectStatusCategory,
    db: AsyncSession = Depends(get_db),
):
    items, _ = await project_status_item_crud.list(
        db,
        filters={
            ProjectStatusItem.project_id: project_id,
            ProjectStatusItem.period_id: period_id,
            ProjectStatusItem.category: category,
        },
        limit=500,
    )
    return items


@items_router.post("", response_model=ProjectStatusItemRead, status_code=status.HTTP_201_CREATED)
async def create_status_item(project_id: UUID, payload: ProjectStatusItemCreate, db: AsyncSession = Depends(get_db)):
    return await project_status_item_crud.create(db, payload, project_id=project_id)


@items_router.put("/{item_id}", response_model=ProjectStatusItemRead)
async def update_status_item(
    project_id: UUID, item_id: UUID, payload: ProjectStatusItemUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await project_status_item_crud.get(db, item_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    return await project_status_item_crud.update(db, obj, payload)


@items_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_status_item(project_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_status_item_crud.get(db, item_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await project_status_item_crud.delete(db, obj)


# Project -> Account rollup (see services/account_rollup.py): Ignore / Undo
# both go through this one endpoint — Pulled is only ever set by the pull
# action itself (POST /accounts/{account_id}/rollup/pull), never here.
@items_router.patch("/{item_id}/rollup-status", response_model=ProjectStatusItemRead)
async def update_status_item_rollup_status(
    project_id: UUID,
    item_id: UUID,
    payload: ProjectStatusItemRollupStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await project_status_item_crud.get(db, item_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    obj.account_rollup_status = payload.status
    await db.flush()
    await db.refresh(obj)
    return obj
