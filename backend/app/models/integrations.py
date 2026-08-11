import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey
from app.models.types import PortableJSON


class IntegrationConnection(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "integration_connections"

    integration_name: Mapped[str] = mapped_column(unique=True)
    connection_status: Mapped[str]  # Connected, Error, Not Configured
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    config: Mapped[dict | None] = mapped_column(PortableJSON)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class BackupRestoreLog(Base, UUIDPrimaryKey):
    __tablename__ = "backup_restore_log"

    action: Mapped[str]  # Backup, Restore
    status: Mapped[str]  # In Progress, Completed, Failed
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    details: Mapped[str | None]
