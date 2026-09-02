import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DateTime, FetchedValue, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey
from app.models.types import CommaSeparatedList


class Project(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "projects"

    project_code: Mapped[str] = mapped_column(unique=True)
    project_name: Mapped[str]
    contract_type: Mapped[str | None]  # FPP, T&M, Capped T&M, Internal
    project_type_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("project_types.id"))
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"))
    project_owned: Mapped[str | None]  # Fully Owned, Co-Owned, Customer Driven
    geo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("geos.id"))
    region_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("regions.id"))
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"))
    project_manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    delivery_manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    delivery_excellence_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    customer_overview: Mapped[str | None]
    project_scope_description: Mapped[str | None]
    project_revenue: Mapped[Decimal | None] = mapped_column(Numeric)
    project_currency: Mapped[str | None]
    billing_type: Mapped[str | None]  # FPP, FB, T&M, Product, Unit Based Billing, Others
    engagement_type: Mapped[str | None]  # Implementation, Support
    critical_flag: Mapped[str | None]  # Yes, No
    product_flag: Mapped[str | None]  # Yes, No
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id"))  # only meaningful when product_flag == Yes

    planned_start_date: Mapped[date | None]
    actual_start_date: Mapped[date | None]
    planned_end_date: Mapped[date | None]
    actual_end_date: Mapped[date | None]
    # DB GENERATED ALWAYS columns (see db/tables/03_projects.sql) — never assigned
    # by the app; Postgres rejects an explicit INSERT/UPDATE value for these.
    # server_default=FetchedValue() tells SQLAlchemy to leave them out of the
    # INSERT/UPDATE column list entirely and re-fetch the computed value
    # instead (crud.base already calls db.refresh() after flush).
    planned_duration_days: Mapped[int | None] = mapped_column(server_default=FetchedValue())
    actual_duration_days: Mapped[int | None] = mapped_column(server_default=FetchedValue())

    # Multi-select on the Project Charter — zero or more SDLC phases the
    # project is currently in. Comma-joined in the TEXT column; list[str] in
    # Python (NULL reads back as []). Nullable to match the existing column.
    applicable_phase: Mapped[list[str] | None] = mapped_column(CommaSeparatedList)
    project_status: Mapped[str]  # Draft, Pending Approval, Approved, Under Amendment, Ongoing, Hold, Closed, Open Only for Billing
    # Health values: Red, Potential Red, Amber, Green. Kept in sync by services.health_rollup.
    delivery_declared_overall_health: Mapped[str | None]
    de_assessed_project_health: Mapped[str | None]
    overall_project_health: Mapped[str | None]

    # DE governance approval (design-reference/de-approval). Set by
    # de_approval.py / de_allocation.py; NULL de_review_status = allocated to a
    # DE but not yet opened for review.
    de_review_status: Mapped[str | None]  # In Review, Returned, Approved
    de_review_remarks: Mapped[str | None]
    de_reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    de_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    de_allocated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class ProjectOracleId(Base, UUIDPrimaryKey):
    __tablename__ = "project_oracle_ids"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    oracle_project_id: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ProjectResource(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "project_resources"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    resource_name: Mapped[str]
    oracle_resource_id: Mapped[str | None]
    role: Mapped[str | None]
    fte_allocation: Mapped[Decimal] = mapped_column(Numeric)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
