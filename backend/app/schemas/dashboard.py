from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.enums import HealthRating


class ProjectTypeBreakdownRow(BaseModel):
    project_type_id: UUID | None
    project_type_name: str | None
    count: int


class ProjectHealthRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    overall_project_health: HealthRating | None
    account_id: UUID | None = None
    account_name: str | None = None


class AccountHealthRow(BaseModel):
    account_id: UUID
    account_name: str
    overall_health: HealthRating | None
    project_count: int


class ContractualComplianceSummary(BaseModel):
    met_count: int
    not_met_count: int
    not_yet_recorded_count: int


class MilestonePaymentSummary(BaseModel):
    upcoming_count: int
    overdue_count: int
    paid_count: int


class HealthMatrixRow(BaseModel):
    """One row of the Account/Project Governance Matrix — the full 6-category
    breakdown for an account or project, not just the rolled-up overall
    health that AccountHealthRow/ProjectHealthRow expose."""

    entity_id: UUID
    entity_label: str
    # Populated on project_matrix rows only (which account the project
    # belongs to) — always None on account_matrix rows, where the entity
    # itself is the account.
    account_id: UUID | None = None
    account_name: str | None = None
    core_delivery_rating: HealthRating | None
    people_rating: HealthRating | None
    operational_rating: HealthRating | None
    customer_rating: HealthRating | None
    financial_rating: HealthRating | None
    compliance_rating: HealthRating | None
    overall_rating: HealthRating | None


class HighlightRow(BaseModel):
    entity_id: UUID
    entity_label: str
    category: str  # ProjectStatusCategory value
    description: str
    created_at: datetime


class DashboardSummary(BaseModel):
    active_projects: int
    projects_by_type: list[ProjectTypeBreakdownRow]
    delayed_projects: int
    open_risks: int
    open_issues: int
    pending_approvals: int
    project_health: list[ProjectHealthRow]
    account_health: list[AccountHealthRow]
    contractual_compliance: ContractualComplianceSummary
    milestone_payments: MilestonePaymentSummary
    account_matrix: list[HealthMatrixRow]
    project_matrix: list[HealthMatrixRow]
    account_highlights: list[HighlightRow]
    project_highlights: list[HighlightRow]
