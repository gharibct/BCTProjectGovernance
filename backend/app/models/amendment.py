import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey
from app.models.types import PortableJSON


class ProjectAmendment(Base, UUIDPrimaryKey, TimestampColumns):
    """One amendment cycle for an already-approved project. Created by
    "Initiate Amendment"; drives where Recall / DE Return route the project
    back to (Under Amendment vs Draft). status: In Progress, Submitted, Completed.
    """

    __tablename__ = "project_amendments"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    status: Mapped[str]  # In Progress, Submitted, Completed
    initiated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    initiated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProjectAmendmentSnapshot(Base, UUIDPrimaryKey):
    """Pre-amendment value of a single project-data row, captured when the
    amendment is initiated. Reference/audit only — no screen reads this.
    """

    __tablename__ = "project_amendment_snapshots"

    amendment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("project_amendments.id", ondelete="CASCADE")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    source_table: Mapped[str]
    source_row_id: Mapped[uuid.UUID | None]
    row_data: Mapped[dict] = mapped_column(PortableJSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
