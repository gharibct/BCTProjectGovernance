"""Per-user in-app notification inbox. Every route is scoped to the caller —
notifications belong to a person (never a Work-Context act-as role)."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_current_user, pagination_params
from app.core.db import get_db
from app.crud.notification import notification_crud
from app.models.notification import Notification
from app.models.users import User
from app.schemas.common import Page
from app.schemas.notification import NotificationRead, UnreadCountResponse
from app.services import notifications as notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=Page[NotificationRead])
async def list_notifications(
    unread_only: bool = Query(default=False),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = [Notification.recipient_id == current_user.id]
    if unread_only:
        conditions.append(Notification.read_at.is_(None))

    total = (
        await db.execute(select(func.count()).select_from(Notification).where(*conditions))
    ).scalar_one()
    items = (
        await db.execute(
            select(Notification)
            .where(*conditions)
            .order_by(Notification.created_at.desc())
            .offset(pagination.skip)
            .limit(pagination.limit)
        )
    ).scalars().all()
    return Page(items=list(items), total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return UnreadCountResponse(
        unread=await notification_service.unread_count(db, current_user.id)
    )


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await notification_crud.get(db, notification_id)
    if obj is None or obj.recipient_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if obj.read_at is None:
        obj.read_at = datetime.now(UTC)
        await db.flush()
        await db.refresh(obj)
    return obj


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.recipient_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
