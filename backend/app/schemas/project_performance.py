from uuid import UUID

from pydantic import BaseModel

from app.schemas.dashboard import (
    AssumptionCardSummary,
    CommitmentsCardSummary,
    DependencyCardSummary,
    IssueCardSummary,
    MetricsComplianceSummary,
    OpportunityCardSummary,
    PaymentMilestonesCardSummary,
    RiskCardSummary,
)
from app.schemas.reporting_attestation import PageCompletionStatus


class ProjectPerformanceDashboardSummary(BaseModel):
    period_id: UUID
    period_label: str
    metrics: MetricsComplianceSummary
    commitments: CommitmentsCardSummary
    payment_milestones: PaymentMilestonesCardSummary
    risks: RiskCardSummary
    issues: IssueCardSummary
    dependencies: DependencyCardSummary
    assumptions: AssumptionCardSummary
    opportunities: OpportunityCardSummary
    completion: list[PageCompletionStatus]
    all_complete: bool
