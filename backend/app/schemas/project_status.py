from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import ReportStatus


class ProjectStatusReportCreate(BaseModel):
    period_id: UUID
    status: ReportStatus = ReportStatus.DRAFT
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None


class ProjectStatusReportUpdate(BaseModel):
    status: ReportStatus | None = None
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None


class ProjectStatusReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    status: ReportStatus
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
