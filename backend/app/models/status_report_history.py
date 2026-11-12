import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKey


class StatusReportHistory(Base, UUIDPrimaryKey):
    """Append-only trail of status report events (db/tables/60_status_report_history.sql)."""

    __tablename__ = "status_report_history"

    report_type: Mapped[str]  # Project, Account, Geo
    report_id: Mapped[uuid.UUID]
    event_type: Mapped[str]  # Submitted, Recalled, Approved, Rejected, Baselined
    from_status: Mapped[str | None]
    to_status: Mapped[str]
    comment: Mapped[str | None]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
