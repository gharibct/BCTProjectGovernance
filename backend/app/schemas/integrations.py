from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import BackupRestoreAction, BackupRestoreStatus, ConnectionStatus, IntegrationName


class IntegrationConnectionCreate(BaseModel):
    integration_name: IntegrationName
    connection_status: ConnectionStatus = ConnectionStatus.NOT_CONFIGURED
    last_sync_at: datetime | None = None
    config: dict[str, Any] | None = None
    updated_by: UUID | None = None


class IntegrationConnectionUpdate(BaseModel):
    connection_status: ConnectionStatus | None = None
    last_sync_at: datetime | None = None
    config: dict[str, Any] | None = None
    updated_by: UUID | None = None


class IntegrationConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    integration_name: IntegrationName
    connection_status: ConnectionStatus
    last_sync_at: datetime | None = None
    config: dict[str, Any] | None = None
    updated_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class BackupRestoreTrigger(BaseModel):
    action: BackupRestoreAction
    triggered_by: UUID | None = None
    details: str | None = None


class BackupRestoreLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    action: BackupRestoreAction
    status: BackupRestoreStatus
    triggered_by: UUID | None = None
    started_at: datetime
    completed_at: datetime | None = None
    details: str | None = None
