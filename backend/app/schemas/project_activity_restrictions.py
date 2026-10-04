from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import ProjectActivity


class ProjectActivityRestrictionWrite(BaseModel):
    not_required_from: date
    reason: str | None = None


class ProjectActivityRestrictionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    activity: ProjectActivity
    not_required_from: date
    reason: str | None = None
    created_by: UUID | None = None
    created_at: datetime
