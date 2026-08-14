from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import ReportStatus


class ExecutiveUpdateCreate(BaseModel):
    period_id: UUID
    status: ReportStatus = ReportStatus.DRAFT
    content: dict[str, Any]
    created_by: UUID | None = None


class ExecutiveUpdateUpdate(BaseModel):
    content: dict[str, Any]


class ExecutiveUpdateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    geo_id: UUID
    period_id: UUID
    status: ReportStatus
    content: dict[str, Any]
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
