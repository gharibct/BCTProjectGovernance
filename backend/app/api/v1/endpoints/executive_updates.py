from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.crud.executive_updates import executive_update_crud
from app.models.executive_updates import ExecutiveUpdate
from app.models.reference_data import ReportingPeriod
from app.schemas.executive_updates import ExecutiveUpdateCreate, ExecutiveUpdateRead, ExecutiveUpdateUpdate

# Geo Head's Executive Update for CXO (see db/tables/43_executive_updates.sql)
# — list/create/edit, same shape as regional_status.py's Geo Status Report
# endpoints, minus review (no submit/review workflow yet — see that file's
# module comment for what a future pass would add). Image upload for image
# blocks lives on this same router: images are referenced from `content`
# only, no DB row of their own, so there's nothing to CRUD beyond the file.
router = APIRouter(prefix="/geos/{geo_id}/executive-updates", tags=["Executive Update"])

_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}


def _by_period_start() -> Any:
    return (
        select(ReportingPeriod.start_date)
        .where(ReportingPeriod.id == ExecutiveUpdate.period_id)
        .scalar_subquery()
        .desc()
    )


@router.get("", response_model=list[ExecutiveUpdateRead])
async def list_executive_updates(geo_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await executive_update_crud.list(
        db,
        filters={ExecutiveUpdate.geo_id: geo_id},
        order_by=_by_period_start(),
        limit=200,
    )
    return items


@router.post("", response_model=ExecutiveUpdateRead, status_code=status.HTTP_201_CREATED)
async def create_executive_update(
    geo_id: UUID,
    payload: ExecutiveUpdateCreate,
    db: AsyncSession = Depends(get_db),
):
    return await executive_update_crud.create(db, payload, geo_id=geo_id)


@router.put("/{update_id}", response_model=ExecutiveUpdateRead)
async def update_executive_update(
    geo_id: UUID,
    update_id: UUID,
    payload: ExecutiveUpdateUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await executive_update_crud.get(db, update_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Executive Update not found")
    return await executive_update_crud.update(db, obj, payload)


# Image blocks — no DB row, `content`'s own `imageUrl` field is the only
# record of an uploaded image. Stored on local disk the same way
# documents.py stores project documents, one subfolder per geo.
class ExecutiveUpdateImageUploaded(BaseModel):
    path: str


@router.post("/images", response_model=ExecutiveUpdateImageUploaded, status_code=status.HTTP_201_CREATED)
async def upload_executive_update_image(
    geo_id: UUID,
    file: UploadFile = File(...),
):
    original_name = file.filename or "image"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in _IMAGE_EXTENSIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only image files (jpg, jpeg, png, gif, webp) are allowed")

    folder = f"executive_updates/{geo_id}"
    disk_name = f"{uuid4()}.{ext}"
    relative_path = f"{folder}/{disk_name}"

    base_dir = Path(settings.document_storage_dir)
    target_dir = base_dir / folder
    target_dir.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    (base_dir / relative_path).write_bytes(content)

    return ExecutiveUpdateImageUploaded(path=relative_path)


@router.get("/images/{filename}")
async def get_executive_update_image(geo_id: UUID, filename: str):
    geo_dir = (Path(settings.document_storage_dir) / "executive_updates" / str(geo_id)).resolve()
    file_path = (geo_dir / filename).resolve()
    # filename comes straight from the URL — reject anything that resolves
    # outside geo_dir (e.g. "../../etc/passwd") before touching the filesystem.
    if geo_dir not in file_path.parents or not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
    return FileResponse(file_path)
