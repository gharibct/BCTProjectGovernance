import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class ProjectStatusReport(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_status_reports"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    status: Mapped[str]  # Draft, Submitted
    key_accomplishments: Mapped[str | None]
    upcoming_key_releases: Mapped[str | None]
    leadership_support_required: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
