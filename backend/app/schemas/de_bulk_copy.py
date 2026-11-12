"""Schemas for the DE bulk copy of the previous assessment into a selected period."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.enums import HealthRating


class BulkCopyRequest(BaseModel):
    period_id: UUID  # the Weekly period the assessments are copied into
    de_user_id: UUID | None = None  # only entities allocated to this DE; None = all DEs


class BulkCopyRow(BaseModel):
    entity_id: UUID  # project_id / account_id
    entity_name: str
    account_name: str | None = None  # project rows only
    delivery_excellence_name: str | None = None
    assessment_date: date | None = None  # the copied assessment's date (unchanged)
    de_health: HealthRating | None = None
    pci_score: Decimal | None = None  # project rows only
    reason: str | None = None  # why it was not copied (failed rows only)


class BulkCopyResult(BaseModel):
    period_label: str
    period_end_date: date
    earliest_assessment_date: date  # period end date - 35 days
    copied: list[BulkCopyRow]
    failed: list[BulkCopyRow]
    skipped: list[BulkCopyRow] = []  # exceptions: already assessed for the period (not copied again)
