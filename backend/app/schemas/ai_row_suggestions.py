from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import AiRowSuggestionStatus


class AiRowSuggestionIn(BaseModel):
    """One extracted candidate row (a whole would-be Risk/Issue/Dependency/
    Assumption/Opportunity), in the shape AI-Implementation.md §10 describes —
    row-level confidence/source/evidence, not per-field. `values` keys match
    that entity's Create schema field names 1:1, same convention the per-field
    ai_field_suggestions use for ProjectPayload/HealthDeclarationCreate keys.

    match_key is a business-code identifier read from the source document
    (e.g. an existing risk_code found in a re-uploaded register) — separate
    from `values` since it isn't part of the entity's own Create schema. It
    drives crud.ai_row_suggestions.upsert_batch's dedupe/update-matching; a
    screen or document with no such identifier just leaves it unset, and the
    row is always treated as a brand-new candidate."""

    values: dict[str, str]
    match_key: str | None = None
    confidence: float = Field(ge=0, le=1)
    source_document: str | None = None
    source_location: str | None = None
    evidence: str | None = None


class AiRowSuggestionBatchIn(BaseModel):
    screen: str
    period_id: UUID
    rows: list[AiRowSuggestionIn]


class AiRowSuggestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    screen: str
    period_id: UUID
    values: dict[str, str]
    match_key: str | None = None
    matched_entity_id: UUID | None = None
    confidence: float
    source_document: str | None = None
    source_location: str | None = None
    evidence: str | None = None
    status: AiRowSuggestionStatus
    created_at: datetime
