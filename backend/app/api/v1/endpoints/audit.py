from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, pagination_params
from app.core.db import get_db
from app.crud.audit import user_activity_log_crud
from app.models.audit import UserActivityLog
from app.schemas.audit import UserActivityLogRead
from app.schemas.common import Page

router = APIRouter(prefix="/audit-log", tags=["Audit Log"])


@router.get("", response_model=Page[UserActivityLogRead])
async def list_activity_log(
    user_id: UUID | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    filters = {}
    if user_id is not None:
        filters[UserActivityLog.user_id] = user_id
    if entity_type is not None:
        filters[UserActivityLog.entity_type] = entity_type

    items, total = await user_activity_log_crud.list(
        db,
        skip=pagination.skip,
        limit=pagination.limit,
        filters=filters,
        order_by=UserActivityLog.created_at.desc(),
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)
