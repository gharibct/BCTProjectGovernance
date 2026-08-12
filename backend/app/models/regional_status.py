import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


# Account Reporting / Geo Reporting — manually authored, period-scoped
# narrative reports (see db/tables/34_account_geo_status_reports.sql).
# Mirrors ProjectStatusReport exactly, keyed by account_id/geo_id instead.
class AccountStatusReport(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "account_status_reports"

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    status: Mapped[str]  # Draft, Submitted
    # Key Metrics — captured once per report alongside the narrative tabs.
    revenue: Mapped[Decimal | None] = mapped_column(Numeric)
    onsite_fte: Mapped[Decimal | None] = mapped_column(Numeric)
    offshore_fte: Mapped[Decimal | None] = mapped_column(Numeric)
    projects_count: Mapped[int | None]
    key_accomplishments: Mapped[str | None]
    upcoming_key_releases: Mapped[str | None]
    leadership_support_required: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    # Review/sign-off by the level above (Geo Head) — set once the report
    # transitions Submitted -> Approved/Rejected.
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_comment: Mapped[str | None]


class GeoStatusReport(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "geo_status_reports"

    geo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("geos.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    status: Mapped[str]  # Draft, Submitted
    # Key Metrics — captured once per report alongside the narrative tabs.
    revenue: Mapped[Decimal | None] = mapped_column(Numeric)
    onsite_fte: Mapped[Decimal | None] = mapped_column(Numeric)
    offshore_fte: Mapped[Decimal | None] = mapped_column(Numeric)
    projects_count: Mapped[int | None]
    key_accomplishments: Mapped[str | None]
    upcoming_key_releases: Mapped[str | None]
    leadership_support_required: Mapped[str | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    # Review/sign-off by the level above (CXO) — set once the report
    # transitions Submitted -> Approved/Rejected.
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_comment: Mapped[str | None]


# Account Reporting / Geo Reporting status grids (see
# db/tables/36_account_geo_status_items.sql) — mirrors ProjectStatusItem
# exactly, keyed by account_id/geo_id instead of project_id.
class AccountStatusItem(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "account_status_items"

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    category: Mapped[str]  # ProjectStatusCategory
    description: Mapped[str]
    # Account -> Geo rollup (see services/geo_rollup.py).
    account_rollup_status: Mapped[str] = mapped_column(default="Pending")  # RollupStatus
    rolled_up_geo_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("geo_status_items.id", ondelete="SET NULL")
    )


class GeoStatusItem(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "geo_status_items"

    geo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("geos.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    category: Mapped[str]  # ProjectStatusCategory
    description: Mapped[str]
