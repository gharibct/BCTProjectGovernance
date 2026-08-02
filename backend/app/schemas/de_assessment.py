from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import Category, FindingClassification, FindingStatus, HealthRating


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
    sequence_no: int
    classification: FindingClassification
    action_taken: str | None = None
    finding_date: date | None = None
    status: FindingStatus = FindingStatus.OPEN
    remarks: str | None = None


class DEAssessmentFindingUpdate(BaseModel):
    classification: FindingClassification | None = None
    action_taken: str | None = None
    finding_date: date | None = None
    status: FindingStatus | None = None
    remarks: str | None = None


class DEAssessmentFindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    assessment_id: UUID
    sequence_no: int
    classification: FindingClassification
    action_taken: str | None = None
    finding_date: date | None = None
    status: FindingStatus
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime


class DEAssessmentCreate(BaseModel):
    assessment_date: date
    de_assessed_project_health: HealthRating
    pci_score: Decimal | None = None
    next_assessment_due_date: date | None = None
    assessed_by: UUID | None = None
    # Required when de_assessed_project_health != Green (UX §4.12); validated
    # in the endpoint since it's a cross-field rule, not a per-field one.
    alert: DEAssessmentAlertIn | None = None
    findings: list[DEAssessmentFindingIn] = []


class DEAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    assessment_date: date
    de_assessed_project_health: HealthRating
    pci_score: Decimal | None = None
    next_assessment_due_date: date | None = None
    assessed_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class DEAssessmentReadWithDetails(DEAssessmentRead):
    alerts: list[DEAssessmentAlertRead] = []
    findings: list[DEAssessmentFindingRead] = []
