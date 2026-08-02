from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import CommitmentFrequency, MetStatus, MilestonePaymentStatus


class ContractualCommitmentCreate(BaseModel):
    frequency: CommitmentFrequency
    commitment_name: str
    formula: str | None = None
    target: str | None = None
    penalty_applicable: bool = False
    penalty_value: Decimal | None = None


class ContractualCommitmentUpdate(BaseModel):
    frequency: CommitmentFrequency | None = None
    commitment_name: str | None = None
    formula: str | None = None
    target: str | None = None
    penalty_applicable: bool | None = None
    penalty_value: Decimal | None = None


class ContractualCommitmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    frequency: CommitmentFrequency
    commitment_name: str
    formula: str | None = None
    target: str | None = None
    penalty_applicable: bool
    penalty_value: Decimal | None = None
    created_at: datetime
    updated_at: datetime


class ContractualCommitmentActualCreate(BaseModel):
    period_date: date
    actual_value: str | None = None
    met_status: MetStatus | None = None
    recorded_by: UUID | None = None


class ContractualCommitmentActualRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    commitment_id: UUID
    period_date: date
    actual_value: str | None = None
    met_status: MetStatus | None = None
    recorded_by: UUID | None = None
    created_at: datetime


class MilestonePaymentCreate(BaseModel):
    milestone_name: str
    milestone_description: str | None = None
    expected_date_of_payment: date | None = None
    expected_payment_value: Decimal | None = None


class MilestonePaymentUpdate(BaseModel):
    milestone_name: str | None = None
    milestone_description: str | None = None
    expected_date_of_payment: date | None = None
    expected_payment_value: Decimal | None = None


class MilestonePaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    milestone_name: str
    milestone_description: str | None = None
    expected_date_of_payment: date | None = None
    expected_payment_value: Decimal | None = None
    created_at: datetime
    updated_at: datetime


class MilestonePaymentActualUpsert(BaseModel):
    actual_date_of_payment: date | None = None
    actual_payment_value: Decimal | None = None
    status: MilestonePaymentStatus | None = None
    remarks: str | None = None


class MilestonePaymentActualRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    milestone_id: UUID
    actual_date_of_payment: date | None = None
    actual_payment_value: Decimal | None = None
    status: MilestonePaymentStatus | None = None
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime
