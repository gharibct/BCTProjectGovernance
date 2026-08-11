from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import AiSuggestionStatus


class AiFieldSuggestionIn(BaseModel):
    """One extracted field, in the shape AI-Implementation.md §3 describes
    (value/confidence/source/location/evidence) — the upstream extraction
    JSON maps onto this almost directly."""

    field_key: str
    value: str | None = None
    confidence: float = Field(ge=0, le=1)
    source_document: str | None = None
    source_location: str | None = None
    evidence: str | None = None


class AiSuggestionBatchIn(BaseModel):
    """Ingest payload for a batch of suggestions targeting one screen of one
    project — whatever delivers the AI's extraction JSON (see
    AI-Implementation.md §2/§3; out of scope here) posts this. period_id ties
    the batch to a reporting_periods row — the seeded 'BASELINE' sentinel for
    project-creation-time extractions, a real Weekly/Monthly period for
    Project Reporting uploads."""

    screen: str
    period_id: UUID
    fields: list[AiFieldSuggestionIn]


class AiSuggestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    screen: str
    period_id: UUID
    field_key: str
    value: str | None = None
    confidence: float
    source_document: str | None = None
    source_location: str | None = None
    evidence: str | None = None
    status: AiSuggestionStatus
    created_at: datetime
