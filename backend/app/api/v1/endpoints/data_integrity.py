from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.api.v1.factory import build_crud_router
from app.core.db import get_db
from app.crud.data_integrity import data_integrity_checklist_item_crud
from app.schemas.data_integrity import (
    DataIntegrityChecklistItemCreate,
    DataIntegrityChecklistItemRead,
    DataIntegrityChecklistItemUpdate,
    DataIntegrityStatusRow,
)
from app.schemas.enums import RoleCode
from app.services.data_integrity_rollup import compute_status_row

router = APIRouter()

# The checklist item catalog is master data — only ADMIN defines what's on
# it; every project's data-integrity-status read below stays open.
router.include_router(
    build_crud_router(
        prefix="/data-integrity-checklist-items",
        tags=["Data Integrity"],
        crud=data_integrity_checklist_item_crud,
        read_schema=DataIntegrityChecklistItemRead,
        create_schema=DataIntegrityChecklistItemCreate,
        update_schema=DataIntegrityChecklistItemUpdate,
        write_dependencies=[Depends(require_role(RoleCode.ADMIN))],
    )
)


@router.get(
    "/projects/{project_id}/data-integrity-status",
    response_model=list[DataIntegrityStatusRow],
    tags=["Data Integrity"],
)
async def get_data_integrity_status(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await data_integrity_checklist_item_crud.list(
        db, filters={data_integrity_checklist_item_crud.model.is_active: True}, limit=500
    )
    return [await compute_status_row(db, project_id, item) for item in items]
