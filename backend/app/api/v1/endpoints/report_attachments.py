from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.endpoints.project_status import _get_report_or_404 as _get_project_report
from app.api.v1.endpoints.project_status import _pm_read, _pm_write, _sanitize_segment
from app.api.v1.endpoints.regional_status import _account_manager_write, _account_read
from app.core.config import settings
from app.core.db import get_db
from app.crud.projects import project_crud
from app.crud.regional_status import account_status_report_crud
from app.models.reference_data import Account, ReportingPeriod
from app.models.report_attachments import ReportAttachment
from app.models.users import User
from app.schemas.report_attachments import ReportAttachmentRead
from app.services.activity_restriction import assert_period_open
from app.services.report_lock import assert_report_editable

# Supporting documents on a Project / Account status report. Many per report;
# only editable (Draft / Rejected) reports accept uploads or deletes, but any
# reader of the report can view them.
project_attachments_router = APIRouter(
    prefix="/projects/{project_id}/status-reports/{report_id}/attachments", tags=["Project Status"]
)
account_attachments_router = APIRouter(
    prefix="/accounts/{account_id}/status-reports/{report_id}/attachments", tags=["Account Reporting"]
)

_ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "png", "jpg", "jpeg"}
_MAX_BYTES = 20 * 1024 * 1024


async def _get_account_report_or_404(db: AsyncSession, account_id: UUID, report_id: UUID):
    obj = await account_status_report_crud.get(db, report_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status report not found")
    return obj


async def _store(db: AsyncSession, file: UploadFile, folder: str, user: User, **owner: UUID) -> ReportAttachment:
    original_name = file.filename or "untitled"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Only {', '.join(sorted(_ALLOWED_EXTENSIONS))} files are allowed"
        )
    content = await file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is too large (20 MB maximum)")

    stem = _sanitize_segment(original_name.rsplit(".", 1)[0])
    relative_path = f"{folder}/{uuid4()}_{stem}.{ext}"
    base_dir = Path(settings.document_storage_dir)
    (base_dir / folder).mkdir(parents=True, exist_ok=True)
    (base_dir / relative_path).write_bytes(content)

    obj = ReportAttachment(
        id=uuid4(),
        file_name=original_name,
        file_path=relative_path,
        file_size=len(content),
        uploaded_by=user.id,
        created_at=datetime.now(UTC),
        **owner,
    )
    db.add(obj)
    await db.flush()
    return obj


async def _list(db: AsyncSession, column, report_id: UUID) -> list[ReportAttachment]:
    stmt = select(ReportAttachment).where(column == report_id).order_by(ReportAttachment.created_at)
    return list((await db.execute(stmt)).scalars().all())


async def _get_owned(db: AsyncSession, column, report_id: UUID, attachment_id: UUID) -> ReportAttachment:
    obj = await db.get(ReportAttachment, attachment_id)
    if obj is None or getattr(obj, column.key) != report_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    return obj


def _file_response(obj: ReportAttachment) -> FileResponse:
    file_path = Path(settings.document_storage_dir) / obj.file_path
    if not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on disk")
    return FileResponse(file_path, filename=obj.file_name)


def _remove_file(obj: ReportAttachment) -> None:
    (Path(settings.document_storage_dir) / obj.file_path).unlink(missing_ok=True)


# ---- Project ---------------------------------------------------------------


@project_attachments_router.get("", response_model=list[ReportAttachmentRead], dependencies=_pm_read)
async def list_project_attachments(project_id: UUID, report_id: UUID, db: AsyncSession = Depends(get_db)):
    await _get_project_report(db, project_id, report_id)
    return await _list(db, ReportAttachment.project_report_id, report_id)


@project_attachments_router.post(
    "", response_model=ReportAttachmentRead, status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def upload_project_attachment(
    project_id: UUID,
    report_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = await _get_project_report(db, project_id, report_id)
    assert_report_editable(report.status)
    await assert_period_open(db, project_id, report.period_id)
    project = await project_crud.get(db, project_id)
    period = await db.get(ReportingPeriod, report.period_id)
    if project is None or period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project or reporting period not found")
    folder = f"{_sanitize_segment(project.project_code)}_{_sanitize_segment(period.code)}/attachments"
    return await _store(db, file, folder, user, project_report_id=report_id)


@project_attachments_router.get("/{attachment_id}", dependencies=_pm_read)
async def download_project_attachment(
    project_id: UUID, report_id: UUID, attachment_id: UUID, db: AsyncSession = Depends(get_db)
):
    await _get_project_report(db, project_id, report_id)
    return _file_response(await _get_owned(db, ReportAttachment.project_report_id, report_id, attachment_id))


@project_attachments_router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_project_attachment(
    project_id: UUID, report_id: UUID, attachment_id: UUID, db: AsyncSession = Depends(get_db)
):
    report = await _get_project_report(db, project_id, report_id)
    assert_report_editable(report.status)
    await assert_period_open(db, project_id, report.period_id)
    obj = await _get_owned(db, ReportAttachment.project_report_id, report_id, attachment_id)
    _remove_file(obj)
    await db.delete(obj)


# ---- Account ---------------------------------------------------------------


@account_attachments_router.get("", response_model=list[ReportAttachmentRead], dependencies=_account_read)
async def list_account_attachments(account_id: UUID, report_id: UUID, db: AsyncSession = Depends(get_db)):
    await _get_account_report_or_404(db, account_id, report_id)
    return await _list(db, ReportAttachment.account_report_id, report_id)


@account_attachments_router.post(
    "", response_model=ReportAttachmentRead, status_code=status.HTTP_201_CREATED, dependencies=_account_manager_write
)
async def upload_account_attachment(
    account_id: UUID,
    report_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = await _get_account_report_or_404(db, account_id, report_id)
    assert_report_editable(report.status)
    account = await db.get(Account, account_id)
    period = await db.get(ReportingPeriod, report.period_id)
    if account is None or period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account or reporting period not found")
    folder = f"account_{_sanitize_segment(str(account.id))}_{_sanitize_segment(period.code)}/attachments"
    return await _store(db, file, folder, user, account_report_id=report_id)


@account_attachments_router.get("/{attachment_id}", dependencies=_account_read)
async def download_account_attachment(
    account_id: UUID, report_id: UUID, attachment_id: UUID, db: AsyncSession = Depends(get_db)
):
    await _get_account_report_or_404(db, account_id, report_id)
    return _file_response(await _get_owned(db, ReportAttachment.account_report_id, report_id, attachment_id))


@account_attachments_router.delete(
    "/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_account_manager_write
)
async def delete_account_attachment(
    account_id: UUID, report_id: UUID, attachment_id: UUID, db: AsyncSession = Depends(get_db)
):
    report = await _get_account_report_or_404(db, account_id, report_id)
    assert_report_editable(report.status)
    obj = await _get_owned(db, ReportAttachment.account_report_id, report_id, attachment_id)
    _remove_file(obj)
    await db.delete(obj)
