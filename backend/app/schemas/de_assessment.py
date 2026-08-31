from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field

from app.schemas.enums import (
    Category,
    DEAssessmentStatus,
    FindingClassification,
    FindingSeverity,
    FindingStatus,
    HealthRating,
)

# A still-open finding with a due date in the past is "overdue" — derived, not
# stored, exactly like ActionRead.overdue.
_FINDING_CLOSED_STATUSES = {FindingStatus.CLOSED, FindingStatus.CANCELLED}


class DEAssessmentAlertIn(BaseModel):
    alert_category: Category | None = None
    brief_description: str
    detailed_description: str | None = None
    raised_by: UUID | None = None
    raised_on: date | None = None


class DEAssessmentAlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    alert_code: str
    assessment_id: UUID
    alert_category: Category | None = None
    brief_description: str
    detailed_description: str | None = None
    raised_by: UUID | None = None
    raised_on: date
    created_at: datetime


class DEAssessmentFindingIn(BaseModel):
    # sequence_no is assigned server-side when omitted (max existing + 1).
    sequence_no: int | None = None
    classification: FindingClassification
    description: str | None = None
    severity: FindingSeverity | None = None
    assigned_to: UUID | None = None
    action_taken: str | None = None
    finding_date: date | None = None
    due_date: date | None = None
    status: FindingStatus = FindingStatus.OPEN
    remarks: str | None = None


class DEAssessmentFindingUpdate(BaseModel):
    classification: FindingClassification | None = None
    description: str | None = None
    severity: FindingSeverity | None = None
    assigned_to: UUID | None = None
    action_taken: str | None = None
    finding_date: date | None = None
    due_date: date | None = None
    status: FindingStatus | None = None
    remarks: str | None = None


class DEAssessmentFindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    assessment_id: UUID
    sequence_no: int
    classification: FindingClassification
    description: str | None = None
    severity: FindingSeverity | None = None
    assigned_to: UUID | None = None
    action_taken: str | None = None
    finding_date: date | None = None
    due_date: date | None = None
    status: FindingStatus
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def overdue(self) -> bool:
        return (
            self.due_date is not None
            and self.due_date < date.today()
            and self.status not in _FINDING_CLOSED_STATUSES
        )


class DEAssessmentCreate(BaseModel):
    """Header only — Alerts and Findings are added afterward, one at a time,
    via their own registers (POST .../alerts, POST .../findings).

    status defaults to Submitted so the legacy project-reporting form (which
    only ever POSTs a finished assessment) is unaffected; the DE Assessment
    Workspace passes status="Draft" for Save Draft.
    """

    assessment_date: date | None = None
    de_assessed_project_health: HealthRating
    pci_score: Decimal | None = None
    remarks: str | None = None
    status: DEAssessmentStatus = DEAssessmentStatus.SUBMITTED
    next_assessment_due_date: date | None = None
    assessed_by: UUID | None = None


class DEAssessmentUpdate(BaseModel):
    """Editing a Draft. Rejected once the assessment is Submitted. Transitioning
    status to Submitted finalizes it (writes back the Project charter health)."""

    de_assessed_project_health: HealthRating | None = None
    pci_score: Decimal | None = None
    remarks: str | None = None
    status: DEAssessmentStatus | None = None


class DEAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    assessment_date: date | None
    de_assessed_project_health: HealthRating
    pci_score: Decimal | None = None
    remarks: str | None = None
    status: DEAssessmentStatus = DEAssessmentStatus.SUBMITTED
    next_assessment_due_date: date | None = None
    assessed_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class DEAssessmentReadWithDetails(DEAssessmentRead):
    alerts: list[DEAssessmentAlertRead] = []
    findings: list[DEAssessmentFindingRead] = []
