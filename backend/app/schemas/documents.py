from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import DocumentAiStatus, DocumentContext


class ProjectDocumentCreate(BaseModel):
    file_name: str
    file_type: str
    storage_path: str
    context: DocumentContext
    period_id: UUID | None = None
    ai_status: DocumentAiStatus = DocumentAiStatus.NOT_PROCESSED
    created_by: UUID | None = None


class ProjectDocumentUpdate(BaseModel):
    ai_status: DocumentAiStatus | None = None


class ProjectDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    file_name: str
    file_type: str
    context: DocumentContext
    period_id: UUID | None = None
    ai_status: DocumentAiStatus
    created_at: datetime
    updated_at: datetime
