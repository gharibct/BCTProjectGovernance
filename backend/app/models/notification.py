import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKey
from app.models.types import PortableJSON


class Notification(Base, UUIDPrimaryKey):
    """One in-app notification for one recipient. Written only via
    app.services.notifications.notify(); `read_at` is the only field the API
    mutates (mark-as-read). See db/tables/51_notifications.sql."""

    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str]
    title: Mapped[str]
    body: Mapped[str | None]
    link: Mapped[str | None]
    entity_type: Mapped[str | None]
    entity_id: Mapped[uuid.UUID | None]
    data: Mapped[dict | None] = mapped_column(PortableJSON)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    # Set only by the periodic scans so a repeated scan doesn't re-notify.
    dedupe_key: Mapped[str | None]
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
