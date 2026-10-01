import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKey


# Supporting documents attached to a Project or Account status report (Record
# Project Status / Record Account Status). Many per report; the file lives on
# local disk under settings.document_storage_dir, only its name/path are kept
# here (see db/tables/56_report_attachments.sql). Exactly one of
# project_report_id / account_report_id is set.
class ReportAttachment(Base, UUIDPrimaryKey):
    __tablename__ = "report_attachments"

    project_report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("project_status_reports.id", ondelete="CASCADE")
    )
    account_report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("account_status_reports.id", ondelete="CASCADE")
    )
    file_name: Mapped[str]
    file_path: Mapped[str]  # relative to settings.document_storage_dir
    file_size: Mapped[int]
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
