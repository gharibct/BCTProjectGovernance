import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class ProjectCreationRequest(Base, UUIDPrimaryKey, TimestampColumns):
    """New Project Creation flow — an Account Head / Geo Head's lightweight
    request to create a project. Delivery Excellence approves it (materialising a
    real projects row in Draft, referenced by approved_project_id) or rejects it
    with a mandatory reason (the row is retained as "Rejected" with
    review_remarks). Only the few fields the pre-approval form collects live
    here; this is not a replica of the projects table.
    """

    __tablename__ = "project_creation_requests"

    project_name: Mapped[str]
    project_manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    # Project profile the requester pre-fills (mirrors the charter's Org / GEO /
    # Region / Account controls); copied onto the Draft project on approval.
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"))
    geo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("geos.id"))
    region_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("regions.id"))
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"))
    status: Mapped[str]  # Pending, Approved, Rejected
    requested_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    approved_project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL")
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_remarks: Mapped[str | None]


class ProjectCreationRequestOracleId(Base, UUIDPrimaryKey):
    __tablename__ = "project_creation_request_oracle_ids"

    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("project_creation_requests.id", ondelete="CASCADE")
    )
    oracle_project_id: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
