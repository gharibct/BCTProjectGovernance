from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.enums import ReportStatus

# Shared by the review endpoints on project/account/geo status reports —
# the reviewer (Account Head/Geo Head/CXO) approves or rejects a Submitted
# report. reviewed_by comes from the client since there's no backend auth
# yet (same pattern as created_by on report creation).


class StatusReportReviewRequest(BaseModel):
    decision: Literal[ReportStatus.APPROVED, ReportStatus.REJECTED]
    comment: str | None = None
    reviewed_by: UUID | None = None
