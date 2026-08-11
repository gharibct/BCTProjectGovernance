import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class ProjectDocument(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_documents"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    file_name: Mapped[str]
    file_type: Mapped[str]  # DOCX, PDF, XLSX, OTHER
    # Where the file lives under settings.document_storage_dir — internal
    # server detail, never exposed to the frontend (see schemas.ProjectDocumentRead).
    storage_path: Mapped[str]
    context: Mapped[str]  # create, reporting
    period_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reporting_periods.id"))
    ai_status: Mapped[str]  # Not Processed, Processing, Processed, Excluded
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
