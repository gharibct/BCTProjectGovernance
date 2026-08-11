import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKey
from app.models.types import PortableINET, PortableJSON


class UserActivityLog(Base, UUIDPrimaryKey):
    __tablename__ = "user_activity_log"

    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str]
    entity_type: Mapped[str | None]
    entity_id: Mapped[uuid.UUID | None]
    details: Mapped[dict | None] = mapped_column(PortableJSON)
    ip_address: Mapped[str | None] = mapped_column(PortableINET)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
