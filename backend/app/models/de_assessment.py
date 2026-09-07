import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class DEAssessment(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "de_assessments"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    assessment_date: Mapped[date | None]
    de_assessed_project_health: Mapped[str]  # Red, Potential Red, Amber, Green
    pci_score: Mapped[Decimal | None] = mapped_column(Numeric)
    remarks: Mapped[str | None]
    status: Mapped[str] = mapped_column(default="Submitted")  # Draft, Submitted
    next_assessment_due_date: Mapped[date | None]
    assessed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class DEAssessmentAlert(Base, UUIDPrimaryKey):
    __tablename__ = "de_assessment_alerts"

    alert_code: Mapped[str] = mapped_column(unique=True)
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("de_assessments.id", ondelete="CASCADE"))
    alert_category: Mapped[str | None]
    brief_description: Mapped[str]
    detailed_description: Mapped[str | None]
    raised_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    raised_on: Mapped[date]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DEAssessmentFinding(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "de_assessment_findings"

    # Findings are a project-level register, independent of any single DE
    # assessment (they outlive it and can be raised without one).
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    sequence_no: Mapped[int]
    category: Mapped[str]  # the Project RAG 6-category taxonomy
    classification: Mapped[str]  # Observation, Recommendation, NC (Non-Conformance)
    description: Mapped[str | None]  # the finding statement
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action_taken: Mapped[str | None]  # what the PM did (PM Findings "Action Taken")
    action_taken_date: Mapped[date | None]  # when the PM recorded the action
    finding_date: Mapped[date | None]
    due_date: Mapped[date | None]
    status: Mapped[str]  # Open, In Progress, Awaiting Closure, Closed, Cancelled (+ legacy On Hold/Deferred)
    remarks: Mapped[str | None]  # DE's verification remarks captured at closure
    closure_date: Mapped[date | None]  # when the DE closed the finding


class DEAssessmentFindingHistory(Base, UUIDPrimaryKey):
    """Append-only audit trail for a finding — one row per creation, status
    move, or PM "Action Taken". Mirrors action_history (db/tables/44_actions.sql).
    """

    __tablename__ = "de_assessment_finding_history"

    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("de_assessment_findings.id", ondelete="CASCADE")
    )
    event_type: Mapped[str]  # CREATED, STATUS_CHANGE, ACTION_TAKEN
    comment: Mapped[str | None]
    old_value: Mapped[str | None]
    new_value: Mapped[str | None]
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
