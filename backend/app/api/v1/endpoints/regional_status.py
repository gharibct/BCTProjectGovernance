from datetime import UTC, date, datetime
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
from app.models.account_health_declarations import AccountHealthItem
from app.models.reference_data import Account, ReportingPeriod
from app.models.regional_status import AccountStatusItem, AccountStatusReport, GeoStatusItem, GeoStatusReport
from app.schemas.copy_from_latest import CopyFromLatestResult
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
from app.schemas.reporting_activity import WeeklyReportingActivityResponse
from app.schemas.status_review import StatusReportReviewRequest
from app.services import dashboard as dashboard_service
from app.services.copy_from_latest import copy_category_items
from app.services.geo_autogen import mark_geo_report_saved, sync_geo_report_from_accounts
from app.services.report_lock import assert_report_editable
from app.services.reporting_activity import build_weekly_reporting_activity

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
_cdo_review = [Depends(require_role(RoleCode.CDO, RoleCode.ADMIN))]
# Reads: an owning Delivery Manager or reviewing Geo Head is ownership-scoped
# same as the write gate, but CDO and Delivery Excellence also get read
# access here (both view across every geo/account by design — CDO already
# reviews geo-level reports unconditionally via _cdo_review, and DE's "My
# Reports" menu section needs the same cross-portfolio visibility — see
# menu-config.ts), so they bypass the ownership check entirely.
_account_read = [
    Depends(
        require_account_or_geo_scope(
            RoleCode.ACCOUNT_MANAGER,
            RoleCode.GEO_HEAD,
            RoleCode.CDO,
            RoleCode.DELIVERY_EXCELLENCE,
            RoleCode.ADMIN,
            bypass_roles=(RoleCode.ADMIN, RoleCode.CDO, RoleCode.DELIVERY_EXCELLENCE),
        )
    )
]
_geo_read = [
    Depends(
        require_geo_scope(
            RoleCode.GEO_HEAD,
            RoleCode.CDO,
            RoleCode.DELIVERY_EXCELLENCE,
            RoleCode.ADMIN,
            bypass_roles=(RoleCode.ADMIN, RoleCode.CDO, RoleCode.DELIVERY_EXCELLENCE),
        )
    )
]


def _by_period_start(model: type) -> Any:
    return select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()


async def _clear_prior_review_on_resubmit(db: AsyncSession, prior_status: str, updated: Any) -> None:
    """A rejected report being resubmitted (Rejected -> Submitted) starts a
    fresh review cycle: drop the previous reviewer's decision so it doesn't
    carry a stale "Reviewed / Rejected on ..." trail into its new Submitted
    state. Mirrors the same guard in project_status.update_status_report."""
    if prior_status == ReportStatus.REJECTED and updated.status == ReportStatus.SUBMITTED:
        updated.reviewed_by = None
        updated.reviewed_at = None
        updated.review_comment = None
        await db.flush()
        await db.refresh(updated)


# The geo's Auto Generated report follows its accounts' filed reports (see
# services/geo_autogen.py) — refreshed whenever an account report is filed,
# resubmitted or reviewed.
async def _sync_geo_report(db: AsyncSession, account_id: UUID, period_id: UUID) -> None:
    account = await db.get(Account, account_id)
    if account is not None and account.geo_id is not None:
        await sync_geo_report_from_accounts(db, account.geo_id, period_id)


ACCOUNT_REPORTS_PENDING_APPROVAL = "ACCOUNT_REPORTS_PENDING_APPROVAL"


async def _approve_submitted_account_reports(
    db: AsyncSession, geo_id: UUID, period_id: UUID, *, confirmed: bool
) -> None:
    """Baselining a geo report requires the period's account reports to be
    Approved. Submitted ones are approved here, but only once the Geo Head has
    confirmed (409 ACCOUNT_REPORTS_PENDING_APPROVAL until then)."""
    stmt = (
        select(AccountStatusReport)
        .join(Account, Account.id == AccountStatusReport.account_id)
        .where(
            Account.geo_id == geo_id,
            AccountStatusReport.period_id == period_id,
            AccountStatusReport.status == ReportStatus.SUBMITTED,
        )
    )
    submitted = (await db.execute(stmt)).scalars().all()
    if not submitted:
        return
    if not confirmed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "code": ACCOUNT_REPORTS_PENDING_APPROVAL,
                "message": f"{len(submitted)} submitted account report(s) must be approved before baselining.",
                "count": len(submitted),
            },
        )
    now = datetime.now(UTC)
    for report in submitted:
        report.status = ReportStatus.APPROVED
        report.reviewed_at = now
        report.review_comment = "Approved on geo report baseline"
    await db.flush()


async def _assert_geo_not_baselined_for_account(db: AsyncSession, account_id: UUID, period_id: UUID) -> None:
    """Once the geo report is Baselined for a period its account reports are
    closed: no account report can be submitted for that period."""
    account = await db.get(Account, account_id)
    if account is None or account.geo_id is None:
        return
    geo_status = (
        await db.execute(
            select(GeoStatusReport.status).where(
                GeoStatusReport.geo_id == account.geo_id, GeoStatusReport.period_id == period_id
            )
        )
    ).scalars().first()
    if geo_status == ReportStatus.BASELINED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The geo report for this period is baselined, so account reports can no longer be submitted for it.",
        )


@account_status_router.get("", response_model=list[AccountStatusReportRead], dependencies=_account_read)
async def list_account_status_reports(account_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await account_status_report_crud.list(
        db,
        filters={AccountStatusReport.account_id: account_id},
        order_by=_by_period_start(AccountStatusReport),
        limit=200,
    )
    return items


@account_status_router.get("/latest", response_model=AccountStatusReportRead, dependencies=_account_read)
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
    period = await db.get(ReportingPeriod, payload.period_id)
    if period is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Reporting period not found")
    if payload.status == ReportStatus.SUBMITTED:
        await _assert_geo_not_baselined_for_account(db, account_id, payload.period_id)
    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(
        db, scope="account", scope_id=account_id
    )
    created = await account_status_report_crud.create(
        db,
        payload,
        account_id=account_id,
        open_alerts_count=alerts_count,
        open_alerts_snapshot=alerts_snapshot,
    )
    await _sync_geo_report(db, account_id, payload.period_id)
    return created


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
    # Submitted/Approved are frozen — only a Draft or Rejected report can be
    # edited here (a Submitted report is only ever decided, via the separate
    # /review endpoint, never edited back through this one).
    assert_report_editable(obj.status)
    if payload.status == ReportStatus.SUBMITTED:
        await _assert_geo_not_baselined_for_account(db, account_id, obj.period_id)
    prior_status = obj.status
    updated = await account_status_report_crud.update(db, obj, payload)

    # Re-snapshot Open Alerts on every edit while still editable — see the
    # matching comment in project_status.update_status_report.
    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(
        db, scope="account", scope_id=account_id
    )
    updated.open_alerts_count = alerts_count
    updated.open_alerts_snapshot = alerts_snapshot
    await db.flush()
    await db.refresh(updated)

    await _clear_prior_review_on_resubmit(db, prior_status, updated)
    await _sync_geo_report(db, account_id, updated.period_id)
    return updated


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
    await _sync_geo_report(db, account_id, obj.period_id)
    return obj


@geo_status_router.get("", response_model=list[GeoStatusReportRead], dependencies=_geo_read)
async def list_geo_status_reports(geo_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await geo_status_report_crud.list(
        db,
        filters={GeoStatusReport.geo_id: geo_id},
        order_by=_by_period_start(GeoStatusReport),
        limit=200,
    )
    return items


@geo_status_router.get("/latest", response_model=GeoStatusReportRead, dependencies=_geo_read)
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
    period = await db.get(ReportingPeriod, payload.period_id)
    if period is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Reporting period not found")
    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(
        db, scope="geo", scope_id=geo_id
    )
    if payload.status in (ReportStatus.DRAFT, ReportStatus.AUTO_GENERATED):
        payload.status = ReportStatus.DRAFT_SAVED
    if payload.status == ReportStatus.BASELINED:
        await _approve_submitted_account_reports(
            db, geo_id, payload.period_id, confirmed=payload.approve_submitted_accounts
        )
    return await geo_status_report_crud.create(
        db,
        payload,
        exclude={"approve_submitted_accounts"},
        geo_id=geo_id,
        open_alerts_count=alerts_count,
        open_alerts_snapshot=alerts_snapshot,
    )


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
    assert_report_editable(obj.status)
    prior_status = obj.status
    if payload.status == ReportStatus.AUTO_GENERATED:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A report cannot be set back to Auto Generated")
    if payload.status == ReportStatus.BASELINED:
        await _approve_submitted_account_reports(
            db, geo_id, obj.period_id, confirmed=payload.approve_submitted_accounts
        )
    updated = await geo_status_report_crud.update(db, obj, payload, exclude={"approve_submitted_accounts"})
    # Any save by the Geo Head takes over an Auto Generated report.
    if prior_status == ReportStatus.AUTO_GENERATED and payload.status is None:
        updated.status = ReportStatus.DRAFT_SAVED

    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(db, scope="geo", scope_id=geo_id)
    updated.open_alerts_count = alerts_count
    updated.open_alerts_snapshot = alerts_snapshot
    await db.flush()
    await db.refresh(updated)

    await _clear_prior_review_on_resubmit(db, prior_status, updated)
    return updated


# Recall: a Baselined geo report goes back to Draft - Saved so the Geo Head can
# edit it again. (Geo reports are baselined, not submitted for review, so
# there is no CDO approve/reject step.)
@geo_status_router.patch("/{report_id}/recall", response_model=GeoStatusReportRead, dependencies=_geo_head_write)
async def recall_geo_status_report(geo_id: UUID, report_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await geo_status_report_crud.get(db, report_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    if obj.status != ReportStatus.BASELINED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only Baselined reports can be recalled")
    obj.status = ReportStatus.DRAFT_SAVED
    await db.flush()
    await db.refresh(obj)
    return obj


# Reporting Hub activity — the Weekly submission timeline behind the progress
# ring and the activity heatmap (design-reference/project-reporting-dashboard,
# adapted for the single Weekly cadence). Read-only aggregation.
account_activity_router = APIRouter(
    prefix="/accounts/{account_id}/reporting-activity", tags=["Account Reporting"]
)
geo_activity_router = APIRouter(prefix="/geos/{geo_id}/reporting-activity", tags=["Geo Reporting"])


@account_activity_router.get("", response_model=WeeklyReportingActivityResponse, dependencies=_account_read)
async def get_account_reporting_activity(
    account_id: UUID, year: int | None = None, db: AsyncSession = Depends(get_db)
):
    return await build_weekly_reporting_activity(db, "account", account_id, year or date.today().year)


@geo_activity_router.get("", response_model=WeeklyReportingActivityResponse, dependencies=_geo_read)
async def get_geo_reporting_activity(
    geo_id: UUID, year: int | None = None, db: AsyncSession = Depends(get_db)
):
    return await build_weekly_reporting_activity(db, "geo", geo_id, year or date.today().year)


# Account Reporting / Geo Reporting status grids (mirrors project_status.py's
# items_router exactly — see db/tables/36_account_geo_status_items.sql).
account_status_items_router = APIRouter(prefix="/accounts/{account_id}/status-items", tags=["Account Reporting"])
geo_status_items_router = APIRouter(prefix="/geos/{geo_id}/status-items", tags=["Geo Reporting"])


# Items have no report_id of their own (keyed by account_id/geo_id + period_id
# + category — see the models) — this is how create/update/delete below find
# out whether the report that period belongs to is frozen.
async def _assert_account_period_editable(db: AsyncSession, account_id: UUID, period_id: UUID) -> None:
    stmt = select(AccountStatusReport.status).where(
        AccountStatusReport.account_id == account_id, AccountStatusReport.period_id == period_id
    )
    assert_report_editable((await db.execute(stmt)).scalars().first())


async def _assert_geo_period_editable(db: AsyncSession, geo_id: UUID, period_id: UUID) -> None:
    stmt = select(GeoStatusReport.status).where(
        GeoStatusReport.geo_id == geo_id, GeoStatusReport.period_id == period_id
    )
    assert_report_editable((await db.execute(stmt)).scalars().first())


# "Copy from latest report" — see project_status.copy_items_from_latest_report.
@account_status_items_router.post(
    "/copy-from-latest", response_model=CopyFromLatestResult, dependencies=_account_manager_write
)
async def copy_account_items_from_latest_report(account_id: UUID, period_id: UUID, db: AsyncSession = Depends(get_db)):
    await _assert_account_period_editable(db, account_id, period_id)
    status_copied, status_source = await copy_category_items(
        db, model=AccountStatusItem, owner_column=AccountStatusItem.account_id, owner_id=account_id, period_id=period_id
    )
    health_copied, health_source = await copy_category_items(
        db, model=AccountHealthItem, owner_column=AccountHealthItem.account_id, owner_id=account_id, period_id=period_id
    )
    return CopyFromLatestResult(copied=status_copied + health_copied, source_period_id=status_source or health_source)


@account_status_items_router.get("", response_model=list[AccountStatusItemRead], dependencies=_account_read)
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
    await _assert_account_period_editable(db, account_id, payload.period_id)
    return await account_status_item_crud.create(db, payload, account_id=account_id)


@account_status_items_router.put("/{item_id}", response_model=AccountStatusItemRead, dependencies=_account_manager_write)
async def update_account_status_item(
    account_id: UUID, item_id: UUID, payload: AccountStatusItemUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await account_status_item_crud.get(db, item_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await _assert_account_period_editable(db, account_id, obj.period_id)
    return await account_status_item_crud.update(db, obj, payload)


@account_status_items_router.delete(
    "/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_account_manager_write
)
async def delete_account_status_item(account_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await account_status_item_crud.get(db, item_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await _assert_account_period_editable(db, account_id, obj.period_id)
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


@geo_status_items_router.get("", response_model=list[GeoStatusItemRead], dependencies=_geo_read)
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
    await _assert_geo_period_editable(db, geo_id, payload.period_id)
    await mark_geo_report_saved(db, geo_id, payload.period_id)
    return await geo_status_item_crud.create(db, payload, geo_id=geo_id)


@geo_status_items_router.put("/{item_id}", response_model=GeoStatusItemRead, dependencies=_geo_head_write)
async def update_geo_status_item(
    geo_id: UUID, item_id: UUID, payload: GeoStatusItemUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await geo_status_item_crud.get(db, item_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await _assert_geo_period_editable(db, geo_id, obj.period_id)
    await mark_geo_report_saved(db, geo_id, obj.period_id)
    return await geo_status_item_crud.update(db, obj, payload)


@geo_status_items_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_geo_head_write)
async def delete_geo_status_item(geo_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await geo_status_item_crud.get(db, item_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await _assert_geo_period_editable(db, geo_id, obj.period_id)
    await mark_geo_report_saved(db, geo_id, obj.period_id)
    await geo_status_item_crud.delete(db, obj)
