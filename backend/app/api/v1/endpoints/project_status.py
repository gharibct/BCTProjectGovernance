import re
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_project_access, require_project_read_access
from app.core.config import settings
from app.core.db import get_db
from app.crud.project_status import project_status_item_crud, project_status_report_crud
from app.crud.projects import project_crud
from app.models.project_status import ProjectStatusItem, ProjectStatusReport
from app.models.reference_data import ReportingPeriod
from app.schemas.enums import ProjectStatusCategory, ReportStatus, RoleCode
from app.schemas.project_status import (
    ProjectStatusItemCreate,
    ProjectStatusItemRead,
    ProjectStatusItemRollupStatusUpdate,
    ProjectStatusItemUpdate,
    ProjectStatusReportCreate,
    ProjectStatusReportRead,
    ProjectStatusReportUpdate,
)
from app.schemas.reporting_activity import ReportingActivityResponse
from app.schemas.status_review import StatusReportReviewRequest
from app.services import dashboard as dashboard_service
from app.services import notifications as notify_svc
from app.services.report_lock import assert_report_editable
from app.services.reporting_activity import build_reporting_activity

# Weekly/Monthly history (UX §4.4 / §7 items 2-3): list (period-sorted) +
# latest + create + edit. No delete — reports are a retained audit trail.
router = APIRouter(prefix="/projects/{project_id}/status-reports", tags=["Project Status"])

# PM work + Account-Head review — both also reachable one level up via the
# top-bar Work Context, scoped to projects in the caller's own accounts/geo.
_pm_write = [Depends(require_project_access(RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_account_manager_review = [Depends(require_project_access(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_pm_read = [Depends(require_project_read_access())]


# Reports are keyed off a reporting_periods row rather than a raw date (see
# db/tables/05_project_status_reports.sql), so ordering has to sort by that
# period's start_date via a correlated subquery — same pattern as
# measurement.py's _by_period_start.
def _by_period_start(model: type) -> Any:
    return (
        select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()
    )


# Key Metrics and the narrative fields carry forward from the previous period so
# a PM only re-keys what actually changed. The frontend pre-fills the form; this
# backs it up for any create path that omits the fields (e.g. the dashboard's
# quick "Submit Report").
_CARRY_FORWARD_FIELDS = (
    "revenue",
    "onsite_fte",
    "offshore_fte",
    "projects_count",
    "key_accomplishments",
    "upcoming_key_releases",
    "leadership_support_required",
)


async def _previous_period_report(
    db: AsyncSession, project_id: UUID, period: ReportingPeriod
) -> ProjectStatusReport | None:
    """The project's most recent status report for a period of the same type
    (Weekly/Monthly) that started before `period`."""
    stmt = (
        select(ProjectStatusReport)
        .join(ReportingPeriod, ReportingPeriod.id == ProjectStatusReport.period_id)
        .where(
            ProjectStatusReport.project_id == project_id,
            ReportingPeriod.period_type == period.period_type,
            ReportingPeriod.start_date < period.start_date,
        )
        .order_by(ReportingPeriod.start_date.desc())
        .limit(1)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return rows[0] if rows else None


# Customer Communication (Project Status screen). "Shared with customer?" is
# mandatory to submit; answering Yes also requires the date shared and the
# uploaded presentation / status report. Answering No drops both (the PM may
# have changed their mind after filling them in).
_CUSTOMER_REPORT_EXTENSIONS = {"pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx"}
_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9_-]+")


def _sanitize_segment(value: str) -> str:
    return _UNSAFE_CHARS.sub("_", value.strip()).strip("_") or "untitled"


def _customer_communication_problem(
    shared: bool | None, date_shared: date | None, file_path: str | None
) -> str | None:
    if shared is None:
        return "Customer Communication: state whether the status report was shared with the customer."
    if shared and date_shared is None:
        return "Customer Communication: Date Shared is required when the report was shared with the customer."
    if shared and not file_path:
        return "Customer Communication: upload the Presentation / Status Report that was shared."
    return None


def _delete_customer_report_file(report: ProjectStatusReport) -> None:
    if report.customer_report_file_path:
        (Path(settings.document_storage_dir) / report.customer_report_file_path).unlink(missing_ok=True)
    report.customer_report_file_name = None
    report.customer_report_file_path = None


@router.get("", response_model=list[ProjectStatusReportRead], dependencies=_pm_read)
async def list_status_reports(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_status_report_crud.list(
        db,
        filters={ProjectStatusReport.project_id: project_id},
        order_by=_by_period_start(ProjectStatusReport),
        limit=200,
    )
    return items


@router.get("/latest", response_model=ProjectStatusReportRead, dependencies=_pm_read)
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


@router.post(
    "", response_model=ProjectStatusReportRead, status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def create_status_report(
    project_id: UUID,
    payload: ProjectStatusReportCreate,
    db: AsyncSession = Depends(get_db),
):
    period = await db.get(ReportingPeriod, payload.period_id)
    if period is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Reporting period not found")

    # Default Revenue / FTE / narrative from the previous period's report for
    # any field the caller left blank.
    previous = await _previous_period_report(db, project_id, period)
    if previous is not None:
        carried = {
            field: getattr(previous, field)
            for field in _CARRY_FORWARD_FIELDS
            if getattr(payload, field) is None and getattr(previous, field) is not None
        }
        if carried:
            payload = payload.model_copy(update=carried)
    elif payload.revenue is None:
        # First report for the project: default Revenue from the project's
        # Revenue in USD (the PM may still change it).
        project = await project_crud.get(db, project_id)
        if project is not None and project.project_revenue_usd is not None:
            payload = payload.model_copy(update={"revenue": project.project_revenue_usd})

    if payload.status == ReportStatus.SUBMITTED:
        # A brand-new report has no uploaded file yet, so only "No" can pass.
        problem = _customer_communication_problem(
            payload.customer_report_shared, payload.customer_report_date, None
        )
        if problem:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, problem)
    if payload.customer_report_shared is False:
        payload = payload.model_copy(update={"customer_report_date": None})

    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(
        db, scope="project", scope_id=project_id
    )
    return await project_status_report_crud.create(
        db,
        payload,
        project_id=project_id,
        open_alerts_count=alerts_count,
        open_alerts_snapshot=alerts_snapshot,
    )


@router.put("/{report_id}", response_model=ProjectStatusReportRead, dependencies=_pm_write)
async def update_status_report(
    project_id: UUID,
    report_id: UUID,
    payload: ProjectStatusReportUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await project_status_report_crud.get(db, report_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    # Submitted/Approved are frozen — only a Draft or Rejected report can be
    # edited here (a Submitted report is only ever decided, via the separate
    # /review endpoint, never edited back through this one).
    assert_report_editable(obj.status)
    was_rejected = obj.status == ReportStatus.REJECTED
    updated = await project_status_report_crud.update(db, obj, payload)

    if updated.customer_report_shared is False:
        updated.customer_report_date = None
        _delete_customer_report_file(updated)
    if updated.status == ReportStatus.SUBMITTED:
        # Raising rolls the whole request back (see get_db), so the report
        # stays as it was and the PM can complete the section first.
        problem = _customer_communication_problem(
            updated.customer_report_shared, updated.customer_report_date, updated.customer_report_file_path
        )
        if problem:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, problem)

    # Re-snapshot Open Alerts on every edit while the report is still
    # editable, so it stays current right up to the moment it's frozen by
    # submission — from then on assert_report_editable above keeps this
    # code from ever running again for this report.
    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(
        db, scope="project", scope_id=project_id
    )
    updated.open_alerts_count = alerts_count
    updated.open_alerts_snapshot = alerts_snapshot
    await db.flush()
    await db.refresh(updated)

    # A rejected report being resubmitted (Rejected -> Submitted) starts a
    # fresh review cycle: drop the previous reviewer's decision so it doesn't
    # carry a stale "Reviewed / Rejected on ..." trail into its new Submitted
    # state, and the reviewer sees a clean Submitted report to act on.
    if was_rejected and updated.status == ReportStatus.SUBMITTED:
        updated.reviewed_by = None
        updated.reviewed_at = None
        updated.review_comment = None
        await db.flush()
        await db.refresh(updated)

    if updated.status == ReportStatus.SUBMITTED:
        project = await project_crud.get(db, project_id)
        if project is not None:
            await notify_svc.notify(
                db,
                recipient_id=await notify_svc.account_head_id(db, project.account_id),
                type="REPORT_SUBMITTED",
                title=f"{project.project_code} submitted a status report",
                body="Awaiting your review.",
                link=f"/project-review/{project.id}",
                entity_type="status_report",
                entity_id=updated.id,
                data={"project_code": project.project_code},
            )
    return updated


# Customer Communication file — the presentation / status report shared with
# the customer. One file per report; uploading again replaces it. Stored on
# local disk like documents.py's uploads, under
# "<project_code>_<period.code>/customer_report/".
async def _get_report_or_404(db: AsyncSession, project_id: UUID, report_id: UUID) -> ProjectStatusReport:
    obj = await project_status_report_crud.get(db, report_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    return obj


@router.post("/{report_id}/customer-report-file", response_model=ProjectStatusReportRead, dependencies=_pm_write)
async def upload_customer_report_file(
    project_id: UUID,
    report_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_report_or_404(db, project_id, report_id)
    assert_report_editable(obj.status)

    original_name = file.filename or "untitled"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in _CUSTOMER_REPORT_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Only {', '.join(sorted(_CUSTOMER_REPORT_EXTENSIONS))} files are allowed",
        )

    project = await project_crud.get(db, project_id)
    period = await db.get(ReportingPeriod, obj.period_id)
    if project is None or period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project or reporting period not found")

    stem = _sanitize_segment(original_name.rsplit(".", 1)[0])
    folder = f"{_sanitize_segment(project.project_code)}_{_sanitize_segment(period.code)}/customer_report"
    relative_path = f"{folder}/{uuid4()}_{stem}.{ext}"
    base_dir = Path(settings.document_storage_dir)
    (base_dir / folder).mkdir(parents=True, exist_ok=True)
    (base_dir / relative_path).write_bytes(await file.read())

    _delete_customer_report_file(obj)  # replaces any earlier upload
    obj.customer_report_file_name = original_name
    obj.customer_report_file_path = relative_path
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/{report_id}/customer-report-file", dependencies=_pm_read)
async def download_customer_report_file(project_id: UUID, report_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await _get_report_or_404(db, project_id, report_id)
    if not obj.customer_report_file_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No customer report file uploaded")
    file_path = Path(settings.document_storage_dir) / obj.customer_report_file_path
    if not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on disk")
    return FileResponse(file_path, filename=obj.customer_report_file_name)


# Review/sign-off (Project Review, for Account Heads): a Submitted report
# transitions to Approved/Rejected by the level above. Direct field
# assignment rather than CRUDBase.update since it needs the status-transition
# guard and a server-set reviewed_at timestamp.
@router.patch("/{report_id}/review", response_model=ProjectStatusReportRead, dependencies=_account_manager_review)
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

    project = await project_crud.get(db, project_id)
    if project is not None:
        await notify_svc.notify(
            db,
            recipient_id=project.project_manager_id,
            type="REPORT_REVIEWED",
            title=f"Your {project.project_code} status report was {str(payload.decision).lower()}",
            body=(payload.comment or None),
            link=f"/project-reporting/{project.id}/dashboard",
            entity_type="status_report",
            entity_id=obj.id,
            actor_id=payload.reviewed_by,
            data={"decision": str(payload.decision), "project_code": project.project_code},
        )
    return obj


# Project Status grids (redesign of the 3 free-text sections above, plus a
# new 4th "Key Risks / Issues" section, into per-category add/edit/delete
# registers — see db/tables/35_project_status_items.sql). Same hand-rolled
# shape as contractual.py's milestones_router (no business-code generation
# needed).
items_router = APIRouter(prefix="/projects/{project_id}/status-items", tags=["Project Status"])


# Items have no report_id of their own (keyed by project_id + period_id +
# category — see the model) — this is how create/update/delete below find
# out whether the report that period belongs to is frozen.
async def _assert_period_editable(db: AsyncSession, project_id: UUID, period_id: UUID) -> None:
    stmt = select(ProjectStatusReport.status).where(
        ProjectStatusReport.project_id == project_id, ProjectStatusReport.period_id == period_id
    )
    report_status = (await db.execute(stmt)).scalars().first()
    assert_report_editable(report_status)


@items_router.get("", response_model=list[ProjectStatusItemRead], dependencies=_pm_read)
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


@items_router.post("", response_model=ProjectStatusItemRead, status_code=status.HTTP_201_CREATED, dependencies=_pm_write)
async def create_status_item(project_id: UUID, payload: ProjectStatusItemCreate, db: AsyncSession = Depends(get_db)):
    await _assert_period_editable(db, project_id, payload.period_id)
    return await project_status_item_crud.create(db, payload, project_id=project_id)


@items_router.put("/{item_id}", response_model=ProjectStatusItemRead, dependencies=_pm_write)
async def update_status_item(
    project_id: UUID, item_id: UUID, payload: ProjectStatusItemUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await project_status_item_crud.get(db, item_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await _assert_period_editable(db, project_id, obj.period_id)
    return await project_status_item_crud.update(db, obj, payload)


@items_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_status_item(project_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_status_item_crud.get(db, item_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found")
    await _assert_period_editable(db, project_id, obj.period_id)
    await project_status_item_crud.delete(db, obj)


# Project -> Account rollup (see services/account_rollup.py): Ignore / Undo
# both go through this one endpoint — Pulled is only ever set by the pull
# action itself (POST /accounts/{account_id}/rollup/pull), never here.
@items_router.patch("/{item_id}/rollup-status", response_model=ProjectStatusItemRead, dependencies=_pm_write)
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


# Reporting Hub (design-reference/project-reporting-dashboard) — the per-period
# Weekly/Monthly submission timeline behind the two progress rings and the two
# activity heatmaps. Read-only aggregation, scoped like every other GET in
# this file via _pm_read.
activity_router = APIRouter(prefix="/projects/{project_id}/reporting-activity", tags=["Project Status"])


@activity_router.get("", response_model=ReportingActivityResponse, dependencies=_pm_read)
async def get_reporting_activity(
    project_id: UUID,
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await build_reporting_activity(db, project_id, year or date.today().year)
