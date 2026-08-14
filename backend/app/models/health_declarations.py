import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class HealthDeclaration(Base, UUIDPrimaryKey):
    __tablename__ = "health_declarations"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))

    # Rating values (all *_rating columns): Red, Potential Red, Amber, Green.
    core_delivery_rating: Mapped[str]
    # Deprecated — superseded by ProjectHealthItem's per-category grids below.
    # Left in place (unused going forward) rather than dropped, to avoid
    # destructive schema changes against a live shared dev database.
    core_delivery_description: Mapped[str | None]
    people_rating: Mapped[str]
    people_description: Mapped[str | None]
    operational_rating: Mapped[str]
    operational_description: Mapped[str | None]
    customer_rating: Mapped[str]
    customer_description: Mapped[str | None]
    financial_rating: Mapped[str]
    financial_description: Mapped[str | None]
    compliance_rating: Mapped[str]
    compliance_description: Mapped[str | None]

    overall_rating: Mapped[str]  # computed by services.health_rollup

    declared_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# One row per line item in a RAG Status grid (see
# db/tables/41_health_items.sql) — replaces HealthDeclaration's per-category
# free-text description columns above with an add/edit/delete register per
# category. Mirrors ProjectStatusItem (models/project_status.py) exactly.
class ProjectHealthItem(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_health_items"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reporting_periods.id"))
    category: Mapped[str]  # Category
    description: Mapped[str]
    # Project -> Account rollup (see services/account_health_rollup.py).
    account_rollup_status: Mapped[str] = mapped_column(default="Pending")  # RollupStatus
    rolled_up_account_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("account_health_items.id", ondelete="SET NULL")
    )
