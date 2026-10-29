import re
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_account_or_geo_scope
from app.core.config import settings
from app.core.db import get_db
from app.models.customer_communications import AccountCustomerCommunication
from app.models.reference_data import Account
from app.models.users import User
from app.schemas.customer_communications import AccountCustomerCommunicationRead
from app.schemas.enums import QbrStatus, RoleCode

# Account Reporting -> Update Account QBR: the QBRs held (or being set up) with
# an account's customer, newest first. Files live on local disk like
# documents.py's uploads, under "<account_id>/customer_communications/".
router = APIRouter(prefix="/accounts/{account_id}/customer-communications", tags=["Account Reporting"])

# Same audience as the Account Reporting screens: an owning Delivery Manager or
# the reviewing Geo Head write; CXO / Delivery Excellence can also read.
_write = [Depends(require_account_or_geo_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_read = [
    Depends(
        require_account_or_geo_scope(
            RoleCode.ACCOUNT_MANAGER,
            RoleCode.GEO_HEAD,
            RoleCode.CXO,
            RoleCode.DELIVERY_EXCELLENCE,
            RoleCode.ADMIN,
            bypass_roles=(RoleCode.ADMIN, RoleCode.CXO, RoleCode.DELIVERY_EXCELLENCE),
        )
    )
]

_ALLOWED_EXTENSIONS = {"ppt", "pptx", "pdf"}
_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9_-]+")


def _sanitize(value: str) -> str:
    return _UNSAFE_CHARS.sub("_", value.strip()).strip("_") or "untitled"


@router.get("", response_model=list[AccountCustomerCommunicationRead], dependencies=_read)
async def list_customer_communications(account_id: UUID, db: AsyncSession = Depends(get_db)):
    # Newest QBR first: the Actual QBR Date once held, else the planned one.
    qbr_date = func.coalesce(AccountCustomerCommunication.actual_date, AccountCustomerCommunication.planned_date)
    stmt = (
        select(AccountCustomerCommunication)
        .where(AccountCustomerCommunication.account_id == account_id)
        .order_by(qbr_date.desc(), AccountCustomerCommunication.created_at.desc())
        .limit(500)
    )
    return (await db.execute(stmt)).scalars().all()


_OPEN_STATUSES = (QbrStatus.INITIATED.value, QbrStatus.SCHEDULED.value)


async def _open_qbr(db: AsyncSession, account_id: UUID) -> AccountCustomerCommunication | None:
    """The account's one QBR still in Initiated / Scheduled, if any."""
    stmt = select(AccountCustomerCommunication).where(
        AccountCustomerCommunication.account_id == account_id,
        AccountCustomerCommunication.status.in_(_OPEN_STATUSES),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _save_qbr(
    db: AsyncSession,
    obj: AccountCustomerCommunication,
    current_user: User,
    *,
    planned_date: date,
    qbr_status: QbrStatus,
    title: str | None,
    actual_date: date | None,
    next_qbr_date: date | None,
    remarks: str | None,
    file: UploadFile | None,
) -> AccountCustomerCommunication:
    """Validates and writes the form onto obj (new or the open QBR). Saving it as
    Conducted also opens the account's next QBR, Initiated on the Next QBR Date."""
    today = date.today()
    conducted = qbr_status == QbrStatus.CONDUCTED
    if conducted:
        title = (title or "").strip()
        if not title:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Meeting / Presentation Title is required when the QBR is Conducted"
            )
        if actual_date is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Actual QBR Date is required when the QBR is Conducted")
        if actual_date > today:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Actual QBR Date cannot be in the future")
        if next_qbr_date is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Next QBR Date is required when the QBR is Conducted")
        if next_qbr_date <= actual_date:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Next QBR Date must be after the Actual QBR Date")
        if file is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload the presentation for a Conducted QBR")
    else:
        # Actual date, title, presentation and Next QBR Date only apply once
        # the QBR has been held.
        actual_date = next_qbr_date = title = file = None

    if file is not None:
        original_name = file.filename or "untitled"
        stem, _, ext = original_name.rpartition(".")
        ext = ext.lower()
        if not stem or ext not in _ALLOWED_EXTENSIONS:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Only {', '.join(sorted(_ALLOWED_EXTENSIONS))} files are allowed"
            )
        folder = f"{obj.account_id}/customer_communications"
        relative_path = f"{folder}/{obj.id}_{_sanitize(stem)}.{ext}"
        base_dir = Path(settings.document_storage_dir)
        (base_dir / folder).mkdir(parents=True, exist_ok=True)
        (base_dir / relative_path).write_bytes(await file.read())
        obj.file_name, obj.file_path = original_name, relative_path

    now = datetime.now(UTC)
    obj.planned_date = planned_date
    obj.actual_date = actual_date
    obj.status = qbr_status.value
    obj.next_qbr_date = next_qbr_date
    obj.title = title
    obj.remarks = (remarks or "").strip() or None
    obj.updated_at = now
    # Flushed before the follow-up is added: at most one open QBR per account
    # (uq_account_customer_communications_open).
    await db.flush()

    if conducted:
        db.add(
            AccountCustomerCommunication(
                id=uuid4(),
                account_id=obj.account_id,
                planned_date=next_qbr_date,
                status=QbrStatus.INITIATED.value,
                created_by=current_user.id,
                created_at=now,
                updated_at=now,
            )
        )
        await db.flush()
    await db.refresh(obj)
    return obj


@router.post(
    "", response_model=AccountCustomerCommunicationRead, status_code=status.HTTP_201_CREATED, dependencies=_write
)
async def create_customer_communication(
    account_id: UUID,
    planned_date: date = Form(...),
    qbr_status: QbrStatus = Form(..., alias="status"),
    title: str | None = Form(None),
    actual_date: date | None = Form(None),
    next_qbr_date: date | None = Form(None),
    remarks: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if await db.get(Account, account_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    if await _open_qbr(db, account_id) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This account already has an Initiated / Scheduled QBR — update that one instead"
        )
    now = datetime.now(UTC)
    obj = AccountCustomerCommunication(
        id=uuid4(), account_id=account_id, created_by=current_user.id, created_at=now, updated_at=now
    )
    db.add(obj)
    return await _save_qbr(
        db,
        obj,
        current_user,
        planned_date=planned_date,
        qbr_status=qbr_status,
        title=title,
        actual_date=actual_date,
        next_qbr_date=next_qbr_date,
        remarks=remarks,
        file=file,
    )


@router.put("/{communication_id}", response_model=AccountCustomerCommunicationRead, dependencies=_write)
async def update_customer_communication(
    account_id: UUID,
    communication_id: UUID,
    planned_date: date = Form(...),
    qbr_status: QbrStatus = Form(..., alias="status"),
    title: str | None = Form(None),
    actual_date: date | None = Form(None),
    next_qbr_date: date | None = Form(None),
    remarks: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = await db.get(AccountCustomerCommunication, communication_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QBR not found")
    if obj.status not in _OPEN_STATUSES:
        raise HTTPException(status.HTTP_409_CONFLICT, "A Conducted QBR can no longer be updated")
    return await _save_qbr(
        db,
        obj,
        current_user,
        planned_date=planned_date,
        qbr_status=qbr_status,
        title=title,
        actual_date=actual_date,
        next_qbr_date=next_qbr_date,
        remarks=remarks,
        file=file,
    )


@router.get("/{communication_id}/file", dependencies=_read)
async def download_customer_communication_file(
    account_id: UUID, communication_id: UUID, db: AsyncSession = Depends(get_db)
):
    obj = await db.get(AccountCustomerCommunication, communication_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Communication not found")
    if obj.file_path is None or obj.file_name is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No presentation uploaded for this QBR")
    file_path = Path(settings.document_storage_dir) / obj.file_path
    if not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on disk")
    return FileResponse(file_path, filename=obj.file_name)
