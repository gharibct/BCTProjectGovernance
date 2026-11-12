from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StatusReportHistoryRead(BaseModel):
    id: UUID
    event_type: str
    from_status: str | None = None
    to_status: str
    comment: str | None = None
    actor_id: UUID | None = None
    actor_name: str | None = None
    created_at: datetime
