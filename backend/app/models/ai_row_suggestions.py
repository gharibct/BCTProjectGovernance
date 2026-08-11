import uuid

from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey
from app.models.types import PortableJSON


class AiRowSuggestion(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "ai_row_suggestions"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    screen: Mapped[str]
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    # DB column is row_values (VALUES is a reserved SQL keyword) — kept as
    # `values` on the model/schema/API/frontend.
    values: Mapped[dict] = mapped_column("row_values", PortableJSON)
    # Business-code identifier extracted from the source document, used to
    # detect repeat uploads and match against existing real rows — see
    # 31_ai_row_suggestions.sql.
    match_key: Mapped[str | None]
    matched_entity_id: Mapped[uuid.UUID | None]
    confidence: Mapped[float] = mapped_column(Float)
    source_document: Mapped[str | None]
    source_location: Mapped[str | None]
    evidence: Mapped[str | None]
    # pending, ignored, applied — see schemas.enums.AiRowSuggestionStatus.
    status: Mapped[str]
