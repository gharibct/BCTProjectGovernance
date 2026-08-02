from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProjectStatusReportCreate(BaseModel):
    report_date: date
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None


class ProjectStatusReportUpdate(BaseModel):
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None


class ProjectStatusReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    report_date: date
    key_accomplishments: str | None = None
    upcoming_key_releases: str | None = None
    leadership_support_required: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
