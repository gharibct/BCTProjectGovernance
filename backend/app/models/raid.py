import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampColumns, UUIDPrimaryKey


class RiskLog(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "risk_log"

    risk_code: Mapped[str] = mapped_column(unique=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    risk_title: Mapped[str]
    risk_description: Mapped[str | None]
    risk_category: Mapped[str | None]
    risk_type: Mapped[str | None]
    identified_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    identified_date: Mapped[date | None]
    risk_owner: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    trigger_event: Mapped[str | None]
    probability: Mapped[str | None]
    impact: Mapped[str | None]
    risk_score: Mapped[int | None]
    severity: Mapped[str | None]
    affected_deliverables: Mapped[str | None]
    affected_milestone: Mapped[str | None]
    response_strategy: Mapped[str | None]
    mitigation_plan: Mapped[str | None]
    contingency_plan: Mapped[str | None]
    residual_risk: Mapped[str | None]
    target_resolution_date: Mapped[date | None]
    current_status: Mapped[str]
    escalation_required: Mapped[bool]
    escalated_to: Mapped[str | None]
    last_review_date: Mapped[date | None]
    next_review_date: Mapped[date | None]
    closure_date: Mapped[date | None]
    remarks: Mapped[str | None]


class IssueLog(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "issue_log"

    issue_code: Mapped[str] = mapped_column(unique=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    issue_title: Mapped[str]
    issue_description: Mapped[str | None]
    issue_category: Mapped[str | None]
    priority: Mapped[str | None]
    severity: Mapped[str | None]
    raised_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    raised_date: Mapped[date | None]
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    root_cause: Mapped[str | None]
    business_impact: Mapped[str | None]
    affected_deliverables: Mapped[str | None]
    affected_milestone: Mapped[str | None]
    resolution_plan: Mapped[str | None]
    due_date: Mapped[date | None]
    actual_resolution_date: Mapped[date | None]
    status: Mapped[str]
    escalation_level: Mapped[str | None]
    escalation_date: Mapped[date | None]
    resolution_summary: Mapped[str | None]
    lessons_learned: Mapped[str | None]
    closure_date: Mapped[date | None]
    remarks: Mapped[str | None]
    last_review_date: Mapped[date | None]
    next_review_date: Mapped[date | None]


class DependencyLog(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "dependency_log"

    dependency_code: Mapped[str] = mapped_column(unique=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    dependency_title: Mapped[str]
    description: Mapped[str | None]
    dependency_type: Mapped[str | None]
    category: Mapped[str | None]
    depends_on: Mapped[str | None]
    related_task_milestone: Mapped[str | None]
    required_by_date: Mapped[date | None]
    owner: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    dependency_status: Mapped[str]
    criticality: Mapped[str | None]
    impact_if_delayed: Mapped[str | None]
    probability_of_delay: Mapped[str | None]
    mitigation_plan: Mapped[str | None]
    escalation_required: Mapped[bool]
    escalation_level: Mapped[str | None]
    actual_completion_date: Mapped[date | None]
    last_updated: Mapped[date | None]
    remarks: Mapped[str | None]
    last_review_date: Mapped[date | None]
    next_review_date: Mapped[date | None]


class AssumptionLog(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "assumption_log"

    assumption_code: Mapped[str] = mapped_column(unique=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    title: Mapped[str]
    detailed_description: Mapped[str | None]
    category: Mapped[str | None]
    raised_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    raised_date: Mapped[date | None]
    owner: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    dependency_reference: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("dependency_log.id"))
    impact_if_invalid: Mapped[str | None]
    probability_of_failure: Mapped[str | None]
    impact_rating: Mapped[str | None]
    validation_date: Mapped[date | None]
    validation_status: Mapped[str]
    mitigation_plan: Mapped[str | None]
    contingency_plan: Mapped[str | None]
    current_status: Mapped[str]
    last_updated: Mapped[date | None]
    remarks: Mapped[str | None]


class OpportunityLog(Base, UUIDPrimaryKey, TimestampColumns):
    __tablename__ = "opportunity_log"

    opportunity_code: Mapped[str] = mapped_column(unique=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    opportunity_title: Mapped[str]
    opportunity_description: Mapped[str | None]
    category: Mapped[str | None]
    identified_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    identified_date: Mapped[date | None]
    opportunity_owner: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    impact: Mapped[str | None]
    expected_benefit: Mapped[str | None]
    estimated_benefit: Mapped[Decimal | None] = mapped_column(Numeric)
    benefit_type: Mapped[str | None]
    exploitation_strategy: Mapped[str | None]
    action_plan: Mapped[str | None]
    target_implementation_date: Mapped[date | None]
    status: Mapped[str]
    approval_required: Mapped[bool]
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    actual_benefit: Mapped[Decimal | None] = mapped_column(Numeric)
    closure_date: Mapped[date | None]
    remarks: Mapped[str | None]
    last_review_date: Mapped[date | None]
    next_review_date: Mapped[date | None]
