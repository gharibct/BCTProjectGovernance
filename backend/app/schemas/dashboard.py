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
