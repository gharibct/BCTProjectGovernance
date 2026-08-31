from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_account_geo_scope, require_account_or_geo_scope, require_geo_scope, require_role
from app.core.db import get_db
from app.crud.regional_status import (
    account_status_item_crud,
    account_status_report_crud,
    geo_status_item_crud,
    geo_status_report_crud,
)
from app.models.reference_data import ReportingPeriod
from app.models.regional_status import AccountStatusItem, AccountStatusReport, GeoStatusItem, GeoStatusReport
from app.schemas.enums import ProjectStatusCategory, ReportStatus, RoleCode
from app.schemas.regional_status import (
    AccountStatusItemCreate,
    AccountStatusItemRead,
    AccountStatusItemRollupStatusUpdate,
    AccountStatusItemUpdate,
    AccountStatusReportCreate,
    AccountStatusReportRead,
    AccountStatusReportUpdate,
    GeoStatusItemCreate,
    GeoStatusItemRead,
    GeoStatusItemUpdate,
    GeoStatusReportCreate,
    GeoStatusReportRead,
    GeoStatusReportUpdate,
)
from app.schemas.status_review import StatusReportReviewRequest

# Account Reporting / Geo Reporting (manually authored, period-scoped —
# see db/tables/34_account_geo_status_reports.sql): list/latest/create/edit,
# same shape as project_status.py's Project Status endpoints. No delete —
# reports are a retained audit trail.
account_status_router = APIRouter(prefix="/accounts/{account_id}/status-reports", tags=["Account Reporting"])
geo_status_router = APIRouter(prefix="/geos/{geo_id}/status-reports", tags=["Geo Reporting"])

# Account-Head work — also reachable by a Geo Head via the top-bar Work Context,
# for accounts in their own geo (require_account_or_geo_scope).
_account_manager_write = [Depends(require_account_or_geo_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_geo_head_review = [Depends(require_account_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_geo_head_write = [Depends(require_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_cxo_review = [Depends(require_role(RoleCode.CXO, RoleCode.ADMIN))]


def _by_period_start(model: type) -> Any:
    return select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()


@account_status_router.get("", response_model=list[AccountStatusReportRead])
async def list_account_status_reports(account_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await account_status_report_crud.list(
        db,
        filters={AccountStatusReport.account_id: account_id},
        order_by=_by_period_start(AccountStatusReport),
        limit=200,
    )
    return items


@account_status_router.get("/latest", response_model=AccountStatusReportRead)
async def get_latest_account_status_report(account_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await account_status_report_crud.list(
        db,
        filters={AccountStatusReport.account_id: account_id},
        order_by=_by_period_start(AccountStatusReport),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No status reports recorded for this account")
    return items[0]


@account_status_router.post(
    "", response_model=AccountStatusReportRead, status_code=status.HTTP_201_CREATED, dependencies=_account_manager_write
)
async def create_account_status_report(
    account_id: UUID,
    payload: AccountStatusReportCreate,
    db: AsyncSession = Depends(get_db),
):
    return await account_status_report_crud.create(db, payload, account_id=account_id)


@account_status_router.put("/{report_id}", response_model=AccountStatusReportRead, dependencies=_account_manager_write)
async def update_account_status_report(
    account_id: UUID,
    report_id: UUID,
    payload: AccountStatusReportUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await account_status_report_crud.get(db, report_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    return await account_status_report_crud.update(db, obj, payload)


# Review/sign-off (Account Review, for Geo Heads): a Submitted report
# transitions to Approved/Rejected by the level above.
@account_status_router.patch("/{report_id}/review", response_model=AccountStatusReportRead, dependencies=_geo_head_review)
async def review_account_status_report(
    account_id: UUID,
    report_id: UUID,
    payload: StatusReportReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    obj = await account_status_report_crud.get(db, report_id)
    if obj is None or obj.account_id != account_id:
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


@geo_status_router.get("", response_model=list[GeoStatusReportRead])
async def list_geo_status_reports(geo_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await geo_status_report_crud.list(
        db,
        filters={GeoStatusReport.geo_id: geo_id},
        order_by=_by_period_start(GeoStatusReport),
        limit=200,
    )
    return items


@geo_status_router.get("/latest", response_model=GeoStatusReportRead)
async def get_latest_geo_status_report(geo_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await geo_status_report_crud.list(
        db,
        filters={GeoStatusReport.geo_id: geo_id},
        order_by=_by_period_start(GeoStatusReport),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No status reports recorded for this geo")
    return items[0]


@geo_status_router.post(
    "", response_model=GeoStatusReportRead, status_code=status.HTTP_201_CREATED, dependencies=_geo_head_write
)
async def create_geo_status_report(
    geo_id: UUID,
    payload: GeoStatusReportCreate,
    db: AsyncSession = Depends(get_db),
):
    return await geo_status_report_crud.create(db, payload, geo_id=geo_id)


@geo_status_router.put("/{report_id}", response_model=GeoStatusReportRead, dependencies=_geo_head_write)
async def update_geo_status_report(
    geo_id: UUID,
    report_id: UUID,
    payload: GeoStatusReportUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await geo_status_report_crud.get(db, report_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    return await geo_status_report_crud.update(db, obj, payload)


# Review/sign-off (Geo Review, for CXO): a Submitted report transitions to
# Approved/Rejected by the level above.
@geo_status_router.patch("/{report_id}/review", response_model=GeoStatusReportRead, dependencies=_cxo_review)
async def review_geo_status_report(
    geo_id: UUID,
    report_id: UUID,
    payload: StatusReportReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    obj = await geo_status_report_crud.get(db, report_id)
    if obj is None or obj.geo_id != geo_id:
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


# Account Reporting / Geo Reporting status grids (mirrors project_status.py's
# items_router exactly — see db/tables/36_account_geo_status_items.sql).
account_status_items_router = APIRouter(prefix="/accounts/{account_id}/status-items", tags=["Account Reporting"])
geo_status_items_router = APIRouter(prefix="/geos/{geo_id}/status-items", tags=["Geo Reporting"])


@account_status_items_router.get("", response_model=list[AccountStatusItemRead])
async def list_account_status_items(
    account_id: UUID,
    period_id: UUID,
    category: ProjectStatusCategory,
    db: AsyncSession = Depends(get_db),
):
    items, _ = await account_status_item_crud.list(
        db,
        filters={
            AccountStatusItem.account_id: account_id,
            AccountStatusItem.period_id: period_id,
            AccountStatusItem.category: category,
        },
        limit=500,
    )
    return items


@account_status_items_router.post(
    "", response_model=AccountStatusItemRead, status_code=status.HTTP_201_CREATED, dependencies=_account_manager_write
)
async def create_account_status_item(
    account_id: UUID, payload: AccountStatusItemCreate, db: AsyncSession = Depends(get_db)
):
    return await account_status_item_crud.create(db, payload, account_id=account_id)


@account_status_items_router.put("/{item_id}", response_model=AccountStatusItemRead, dependencies=_account_manager_write)
async def update_account_status_item(
    account_id: UUID, item_id: UUID, payload: AccountStatusItemUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await account_status_item_crud.get(db, item_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    return await account_status_item_crud.update(db, obj, payload)


@account_status_items_router.delete(
    "/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_account_manager_write
)
async def delete_account_status_item(account_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await account_status_item_crud.get(db, item_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await account_status_item_crud.delete(db, obj)


# Account -> Geo rollup (see services/geo_rollup.py): Ignore / Undo both go
# through this one endpoint — Pulled is only ever set by the pull action
# itself (POST /geos/{geo_id}/rollup/pull), never here.
@account_status_items_router.patch(
    "/{item_id}/rollup-status", response_model=AccountStatusItemRead, dependencies=_account_manager_write
)
async def update_account_status_item_rollup_status(
    account_id: UUID,
    item_id: UUID,
    payload: AccountStatusItemRollupStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await account_status_item_crud.get(db, item_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    obj.account_rollup_status = payload.status
    await db.flush()
    await db.refresh(obj)
    return obj


@geo_status_items_router.get("", response_model=list[GeoStatusItemRead])
async def list_geo_status_items(
    geo_id: UUID,
    period_id: UUID,
    category: ProjectStatusCategory,
    db: AsyncSession = Depends(get_db),
):
    items, _ = await geo_status_item_crud.list(
        db,
        filters={
            GeoStatusItem.geo_id: geo_id,
            GeoStatusItem.period_id: period_id,
            GeoStatusItem.category: category,
        },
        limit=500,
    )
    return items


@geo_status_items_router.post(
    "", response_model=GeoStatusItemRead, status_code=status.HTTP_201_CREATED, dependencies=_geo_head_write
)
async def create_geo_status_item(geo_id: UUID, payload: GeoStatusItemCreate, db: AsyncSession = Depends(get_db)):
    return await geo_status_item_crud.create(db, payload, geo_id=geo_id)


@geo_status_items_router.put("/{item_id}", response_model=GeoStatusItemRead, dependencies=_geo_head_write)
async def update_geo_status_item(
    geo_id: UUID, item_id: UUID, payload: GeoStatusItemUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await geo_status_item_crud.get(db, item_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    return await geo_status_item_crud.update(db, obj, payload)


@geo_status_items_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_geo_head_write)
async def delete_geo_status_item(geo_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await geo_status_item_crud.get(db, item_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await geo_status_item_crud.delete(db, obj)
