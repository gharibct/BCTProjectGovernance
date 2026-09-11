from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import ReportPageType


class MonthlyReportAttestationCreate(BaseModel):
    period_id: UUID
    page_type: ReportPageType


class MonthlyReportAttestationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    period_id: UUID
    page_type: ReportPageType
    reviewed_by: UUID | None = None
    reviewed_at: datetime


class PageCompletionStatus(BaseModel):
    """One row of the Project Performance Report's monthly completion
    checklist. `reason` is "data_saved" (something was saved/updated on that
    page this period), "reviewed_no_changes" (an attestation exists), or
    "outstanding" (neither)."""

    page_type: ReportPageType
    complete: bool
    reason: str
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
