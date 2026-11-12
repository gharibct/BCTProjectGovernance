import uuid
from datetime import date, datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class DEAccountAudit(Base, UUIDPrimaryKey, TimestampColumns):
    """Account-level counterpart of DEAssessment (db/tables/59_de_account_audits.sql)."""

    __tablename__ = "de_account_audits"

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    audit_date: Mapped[date | None]
    de_assessed_health: Mapped[str]  # Red, Potential Red, Amber, Green
    remarks: Mapped[str | None]
    status: Mapped[str] = mapped_column(default="Submitted")  # Draft, Submitted
    next_audit_due_date: Mapped[date | None]
    # Weekly reporting period the assessment is aligned with (as on DEAssessment).
    period_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reporting_periods.id"))
    audited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    # Projects of the account the DE team covered in this review (Project Health section).
    covered_project_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), default=list, server_default="{}"
    )


class DEAccountFinding(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "de_account_findings"

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    sequence_no: Mapped[int]
    category: Mapped[str]  # the shared 6-category taxonomy
    classification: Mapped[str]  # Observation, Recommendation, Alert
    description: Mapped[str | None]
    action_taken: Mapped[str | None]  # what the Delivery Manager did
    action_taken_date: Mapped[date | None]
    finding_date: Mapped[date | None]
    due_date: Mapped[date | None]
    status: Mapped[str]  # Open, In Progress, Awaiting Closure, Closed, Cancelled
    remarks: Mapped[str | None]  # DE verification remarks captured at closure
    closure_date: Mapped[date | None]
    # Optional: projects of the account this finding relates to.
    project_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), default=list, server_default="{}"
    )


class DEAccountFindingHistory(Base, UUIDPrimaryKey):
    """Append-only trail for an account finding (CREATED, STATUS_CHANGE, ACTION_TAKEN)."""

    __tablename__ = "de_account_finding_history"

    finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("de_account_findings.id", ondelete="CASCADE"))
    event_type: Mapped[str]
    comment: Mapped[str | None]
    old_value: Mapped[str | None]
    new_value: Mapped[str | None]
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
