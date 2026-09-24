import re
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_account_or_geo_scope
from app.core.config import settings
from app.core.db import get_db
from app.models.customer_communications import AccountCustomerCommunication
from app.models.reference_data import Account
from app.models.users import User
from app.schemas.customer_communications import AccountCustomerCommunicationRead
from app.schemas.enums import RoleCode

# Account Reporting -> Customer Communications: the meetings / presentations
# shared with an account's customer, newest first. Files live on local disk like
# documents.py's uploads, under "<account_id>/customer_communications/".
router = APIRouter(prefix="/accounts/{account_id}/customer-communications", tags=["Account Reporting"])

# Same audience as the Account Reporting screens: an owning Account Manager or
# the reviewing Geo Head write; CDO / Delivery Excellence can also read.
_write = [Depends(require_account_or_geo_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_read = [
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

_ALLOWED_EXTENSIONS = {"ppt", "pptx", "pdf"}
_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9_-]+")


def _sanitize(value: str) -> str:
    return _UNSAFE_CHARS.sub("_", value.strip()).strip("_") or "untitled"


@router.get("", response_model=list[AccountCustomerCommunicationRead], dependencies=_read)
async def list_customer_communications(account_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(AccountCustomerCommunication)
        .where(AccountCustomerCommunication.account_id == account_id)
        .order_by(AccountCustomerCommunication.reporting_date.desc(), AccountCustomerCommunication.created_at.desc())
        .limit(500)
    )
    return (await db.execute(stmt)).scalars().all()


@router.post(
    "", response_model=AccountCustomerCommunicationRead, status_code=status.HTTP_201_CREATED, dependencies=_write
)
async def create_customer_communication(
    account_id: UUID,
    reporting_date: date = Form(...),
    title: str = Form(...),
    remarks: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if await db.get(Account, account_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    title = title.strip()
    if not title:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Meeting / Presentation Title is required")

    original_name = file.filename or "untitled"
    stem, _, ext = original_name.rpartition(".")
    ext = ext.lower()
    if not stem or ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Only {', '.join(sorted(_ALLOWED_EXTENSIONS))} files are allowed"
        )

    comm_id = uuid4()
    folder = f"{account_id}/customer_communications"
    relative_path = f"{folder}/{comm_id}_{_sanitize(stem)}.{ext}"
    base_dir = Path(settings.document_storage_dir)
    (base_dir / folder).mkdir(parents=True, exist_ok=True)
    (base_dir / relative_path).write_bytes(await file.read())

    now = datetime.now(UTC)
    obj = AccountCustomerCommunication(
        id=comm_id,
        account_id=account_id,
        reporting_date=reporting_date,
        title=title,
        file_name=original_name,
        file_path=relative_path,
        remarks=(remarks or "").strip() or None,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/{communication_id}/file", dependencies=_read)
async def download_customer_communication_file(
    account_id: UUID, communication_id: UUID, db: AsyncSession = Depends(get_db)
):
    obj = await db.get(AccountCustomerCommunication, communication_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Communication not found")
    file_path = Path(settings.document_storage_dir) / obj.file_path
    if not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on disk")
    return FileResponse(file_path, filename=obj.file_name)
