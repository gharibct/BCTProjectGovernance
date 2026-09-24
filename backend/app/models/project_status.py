import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey
from app.models.types import PortableJSON


class ProjectStatusReport(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_status_reports"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    status: Mapped[str]  # ReportStatus: Draft, Submitted, Approved, Rejected
    # Key Metrics — captured once per report alongside the narrative tabs.
    revenue: Mapped[Decimal | None] = mapped_column(Numeric)
    onsite_fte: Mapped[Decimal | None] = mapped_column(Numeric)
    offshore_fte: Mapped[Decimal | None] = mapped_column(Numeric)
    projects_count: Mapped[int | None]
    # Deprecated — superseded by ProjectStatusItem's per-category grids
    # below. Left in place (unused going forward) rather than dropped, to
    # avoid destructive schema changes against a live shared dev database.
    key_accomplishments: Mapped[str | None]
    upcoming_key_releases: Mapped[str | None]
    leadership_support_required: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    # Review/sign-off by the level above (Account Head/Geo Head/CDO) — set
    # once the report transitions Submitted -> Approved/Rejected.
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_comment: Mapped[str | None]
    # Open Alerts snapshot (see api/v1/endpoints/project_status.py) — a
    # frozen count + row-detail list of Open Alerts as of this period's end
    # date, refreshed on every save while the report is still editable.
    open_alerts_count: Mapped[int] = mapped_column(default=0, server_default="0")
    open_alerts_snapshot: Mapped[list | None] = mapped_column(PortableJSON)
    # Customer Communication — was the status report shared with the customer?
    # NULL = not answered yet. When True, the date shared and the uploaded
    # presentation / status report are required to submit (see
    # api/v1/endpoints/project_status.py); flipping to False clears them.
    customer_report_shared: Mapped[bool | None]
    customer_report_date: Mapped[date | None] = mapped_column(Date)
    customer_report_file_name: Mapped[str | None]
    customer_report_file_path: Mapped[str | None]  # relative to settings.document_storage_dir
    customer_remarks: Mapped[str | None]


# One row per line item in a Project Status grid (see
# db/tables/35_project_status_items.sql) — replaces ProjectStatusReport's
# free-text columns above with an add/edit/delete register per category.
class ProjectStatusItem(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_status_items"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    category: Mapped[str]  # ProjectStatusCategory
    description: Mapped[str]
    # Project -> Account rollup (see services/account_rollup.py).
    account_rollup_status: Mapped[str] = mapped_column(default="Pending")  # RollupStatus
    rolled_up_account_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("account_status_items.id", ondelete="SET NULL")
    )
