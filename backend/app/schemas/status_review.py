from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator

from app.schemas.enums import ReportStatus

# Shared by the review endpoints on project/account/geo status reports —
# the reviewer (Account Head/Geo Head/CDO) approves or rejects a Submitted
# report. reviewed_by comes from the client since there's no backend auth
# yet (same pattern as created_by on report creation).


class StatusReportRecallRequest(BaseModel):
    """The reporter pulling their own Submitted report back (before it is
    approved). The reason is mandatory so the reviewer can see why."""

    remarks: str

    @field_validator("remarks")
    @classmethod
    def _remarks_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Recall remarks are required.")
        return value


class StatusReportReviewRequest(BaseModel):
    decision: Literal[ReportStatus.APPROVED, ReportStatus.REJECTED]
    comment: str | None = None
    reviewed_by: UUID | None = None

    @model_validator(mode="after")
    def _rejection_needs_remarks(self):
        # The reporter needs to know what to fix before resubmitting, so a
        # rejection is only accepted with remarks (approval stays optional).
        if self.decision == ReportStatus.REJECTED:
            self.comment = (self.comment or "").strip()
            if not self.comment:
                raise ValueError("Rejection remarks are required when rejecting a report.")
        return self
