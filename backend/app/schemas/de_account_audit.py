"""Schemas for DE Account Audit (account-level DE assessment + findings)."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.schemas.enums import (
    Category,
    DEAssessmentStatus,
    DEFindingHistoryEventType,
    FindingClassification,
    FindingStatus,
    HealthRating,
)

_CLOSED = {FindingStatus.CLOSED, FindingStatus.CANCELLED}


# --- Audits -----------------------------------------------------------------


class DEAccountAuditCreate(BaseModel):
    """`audited_by` always comes from the session. status defaults to Submitted;
    the workspace passes "Draft" for Save Draft."""

    audit_date: date | None = None
    de_assessed_health: HealthRating
    remarks: str | None = None
    status: DEAssessmentStatus = DEAssessmentStatus.SUBMITTED
    next_audit_due_date: date | None = None
    period_id: UUID | None = None
    covered_project_ids: list[UUID] = Field(default_factory=list)


class DEAccountAuditUpdate(BaseModel):
    """Edit a Draft (rejected once Submitted)."""

    audit_date: date | None = None
    de_assessed_health: HealthRating | None = None
    remarks: str | None = None
    status: DEAssessmentStatus | None = None
    next_audit_due_date: date | None = None
    period_id: UUID | None = None
    covered_project_ids: list[UUID] | None = None


class DEAccountAuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    audit_date: date | None = None
    de_assessed_health: HealthRating
    remarks: str | None = None
    status: DEAssessmentStatus
    next_audit_due_date: date | None = None
    period_id: UUID | None = None
    covered_project_ids: list[UUID] = Field(default_factory=list)
    audited_by: UUID | None = None
    audited_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class DEAccountQueueRow(BaseModel):
    account_id: UUID
    account_name: str
    geo_name: str | None = None
    region_name: str | None = None
    critical_flag: str = "No"
    account_head_name: str | None = None
    delivery_excellence_name: str | None = None
    status: Literal["Due", "Draft", "Audited"]
    de_health: HealthRating | None = None  # latest submitted audit's rating
    last_audit_date: date | None = None
    open_findings_count: int = 0


class DEAccountQueue(BaseModel):
    period_label: str
    total_count: int
    audited_count: int
    due_count: int
    red_amber_count: int
    open_findings_count: int
    rows: list[DEAccountQueueRow]


# --- Findings ---------------------------------------------------------------


class DEAccountFindingCreate(BaseModel):
    account_id: UUID
    category: Category
    classification: FindingClassification
    description: str | None = None
    finding_date: date
    due_date: date
    project_ids: list[UUID] = Field(default_factory=list)  # optional


class DEAccountFindingUpdate(BaseModel):
    category: Category | None = None
    classification: FindingClassification | None = None
    description: str | None = None
    finding_date: date | None = None
    due_date: date | None = None
    status: FindingStatus | None = None
    remarks: str | None = None
    closure_date: date | None = None


class DEAccountFindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    sequence_no: int
    category: str
    classification: FindingClassification
    description: str | None = None
    action_taken: str | None = None
    action_taken_date: date | None = None
    finding_date: date | None = None
    due_date: date | None = None
    status: FindingStatus
    remarks: str | None = None
    closure_date: date | None = None
    project_ids: list[UUID] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def overdue(self) -> bool:
        return self.due_date is not None and self.due_date < date.today() and self.status not in _CLOSED


class DEAccountFindingRow(DEAccountFindingRead):
    """List row: the finding plus the account labels the grid shows."""

    account_name: str | None = None
    geo_name: str | None = None
    region_name: str | None = None
    age_days: int | None = None
    project_codes: list[str] = Field(default_factory=list)


class DEAccountFindingsKpis(BaseModel):
    open_findings: int
    overdue: int
    awaiting_closure: int
    closed_this_period: int
    period_label: str | None = None


class DEAccountFindingHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    finding_id: UUID
    event_type: DEFindingHistoryEventType
    comment: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_by: UUID
    created_at: datetime


class AccountFindingActionTaken(BaseModel):
    """Delivery Manager records what was done; the finding moves to Awaiting Closure."""

    action_taken: str = Field(min_length=1)
    action_taken_date: date | None = None
