from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    recipient_id: UUID
    type: str
    title: str
    body: str | None = None
    link: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    data: dict[str, Any] | None = None
    actor_id: UUID | None = None
    read_at: datetime | None = None
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread: int
