import uuid

from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class AiFieldSuggestion(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "ai_field_suggestions"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    screen: Mapped[str]
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    field_key: Mapped[str]
    value: Mapped[str | None]
    confidence: Mapped[float] = mapped_column(Float)
    source_document: Mapped[str | None]
    source_location: Mapped[str | None]
    evidence: Mapped[str | None]
    # pending, ignored, resolved — see schemas.enums.AiSuggestionStatus.
    status: Mapped[str]
