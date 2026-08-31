import uuid
from datetime import date, datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class Action(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "actions"

    action_code: Mapped[str] = mapped_column(unique=True)
    level: Mapped[str]
    level_value: Mapped[str]

    title: Mapped[str]
    description: Mapped[str | None]
    action_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    priority: Mapped[str]
    status: Mapped[str]

    due_date: Mapped[date]
    raised_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    raised_at: Mapped[datetime]
    completed_at: Mapped[datetime | None]
    closed_at: Mapped[datetime | None]
    closed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class ActionHistory(Base, UUIDPrimaryKey):
    __tablename__ = "action_history"

    action_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("actions.id", ondelete="CASCADE"))
    event_type: Mapped[str]
    comment: Mapped[str | None]
    old_value: Mapped[str | None]
    new_value: Mapped[str | None]
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime]
