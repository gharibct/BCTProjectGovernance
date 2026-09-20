from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class BulkStatusReportBase(BaseModel):
    """One row of the Admin bulk Delivery Status upload: a Draft status report
    for one period — Key Metrics plus the four narrative categories, each a
    list of items (one register line each). The period is named by its code
    (e.g. 2026-W31, 2026-07) or label, resolved server-side."""

    period: str
    revenue: Decimal | None = None
    onsite_fte: Decimal | None = None
    offshore_fte: Decimal | None = None
    projects_count: int | None = None
    key_accomplishments: list[str] = []
    upcoming_key_releases: list[str] = []
    leadership_support_required: list[str] = []
    key_risks_issues: list[str] = []


class BulkProjectStatusReport(BulkStatusReportBase):
    project_code: str


class BulkAccountStatusReport(BulkStatusReportBase):
    account_id: UUID
