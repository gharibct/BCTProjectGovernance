from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReportAttachmentRead(BaseModel):
    id: UUID
    file_name: str
    file_size: int
    uploaded_by: UUID | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
