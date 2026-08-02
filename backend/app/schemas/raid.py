from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.enums import (
    AssumptionStatus,
    BenefitType,
    Category,
    Criticality,
    DependencyEscalationLevel,
    DependencyStatus,
    DependencyType,
    ExpectedBenefit,
    ExploitationStrategy,
    Impact,
    ImpactRating,
    IssueEscalationLevel,
    IssuePriority,
    IssueSeverity,
    IssueStatus,
    OpportunityImpact,
    OpportunityStatus,
    Probability,
    ProbabilityOfDelay,
    ProbabilityOfFailure,
    ResponseStrategy,
    RiskSeverity,
    RiskStatus,
    RiskType,
    ValidationStatus,
)

# --- Risk ---


class RiskLogCreate(BaseModel):
    risk_title: str
    risk_description: str | None = None
    risk_category: Category | None = None
    risk_type: RiskType | None = None
    identified_by: UUID | None = None
    identified_date: date | None = None
    risk_owner: UUID | None = None
    trigger_event: str | None = None
    probability: Probability | None = None
    impact: Impact | None = None
    severity: RiskSeverity | None = None
    affected_deliverables: str | None = None
    affected_milestone: str | None = None
    response_strategy: ResponseStrategy | None = None
    mitigation_plan: str | None = None
    contingency_plan: str | None = None
    residual_risk: str | None = None
    target_resolution_date: date | None = None
    escalation_required: bool = False
    escalated_to: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    remarks: str | None = None


class RiskLogUpdate(BaseModel):
    risk_title: str | None = None
    risk_description: str | None = None
    risk_category: Category | None = None
    risk_type: RiskType | None = None
    identified_by: UUID | None = None
    identified_date: date | None = None
    risk_owner: UUID | None = None
    trigger_event: str | None = None
    probability: Probability | None = None
    impact: Impact | None = None
    severity: RiskSeverity | None = None
    affected_deliverables: str | None = None
    affected_milestone: str | None = None
    response_strategy: ResponseStrategy | None = None
    mitigation_plan: str | None = None
    contingency_plan: str | None = None
    residual_risk: str | None = None
    target_resolution_date: date | None = None
    current_status: RiskStatus | None = None
    escalation_required: bool | None = None
    escalated_to: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    closure_date: date | None = None
    remarks: str | None = None


class RiskLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    risk_code: str
    project_id: UUID
    risk_title: str
    risk_description: str | None = None
    risk_category: Category | None = None
    risk_type: RiskType | None = None
    identified_by: UUID | None = None
    identified_date: date | None = None
    risk_owner: UUID | None = None
    trigger_event: str | None = None
    probability: Probability | None = None
    impact: Impact | None = None
    risk_score: int | None = None
    severity: RiskSeverity | None = None
    affected_deliverables: str | None = None
    affected_milestone: str | None = None
    response_strategy: ResponseStrategy | None = None
    mitigation_plan: str | None = None
    contingency_plan: str | None = None
    residual_risk: str | None = None
    target_resolution_date: date | None = None
    current_status: RiskStatus
    escalation_required: bool
    escalated_to: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    closure_date: date | None = None
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Issue ---


class IssueLogCreate(BaseModel):
    issue_title: str
    issue_description: str | None = None
    issue_category: str | None = None
    priority: IssuePriority | None = None
    severity: IssueSeverity | None = None
    raised_by: UUID | None = None
    raised_date: date | None = None
    assigned_to: UUID | None = None
    root_cause: str | None = None
    business_impact: str | None = None
    affected_deliverables: str | None = None
    affected_milestone: str | None = None
    resolution_plan: str | None = None
    due_date: date | None = None
    escalation_level: IssueEscalationLevel | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    remarks: str | None = None


class IssueLogUpdate(BaseModel):
    issue_title: str | None = None
    issue_description: str | None = None
    issue_category: str | None = None
    priority: IssuePriority | None = None
    severity: IssueSeverity | None = None
    assigned_to: UUID | None = None
    root_cause: str | None = None
    business_impact: str | None = None
    affected_deliverables: str | None = None
    affected_milestone: str | None = None
    resolution_plan: str | None = None
    due_date: date | None = None
    actual_resolution_date: date | None = None
    status: IssueStatus | None = None
    escalation_level: IssueEscalationLevel | None = None
    escalation_date: date | None = None
    resolution_summary: str | None = None
    lessons_learned: str | None = None
    closure_date: date | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    remarks: str | None = None


class IssueLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    issue_code: str
    project_id: UUID
    issue_title: str
    issue_description: str | None = None
    issue_category: str | None = None
    priority: IssuePriority | None = None
    severity: IssueSeverity | None = None
    raised_by: UUID | None = None
    raised_date: date | None = None
    assigned_to: UUID | None = None
    root_cause: str | None = None
    business_impact: str | None = None
    affected_deliverables: str | None = None
    affected_milestone: str | None = None
    resolution_plan: str | None = None
    due_date: date | None = None
    actual_resolution_date: date | None = None
    status: IssueStatus
    escalation_level: IssueEscalationLevel | None = None
    escalation_date: date | None = None
    resolution_summary: str | None = None
    lessons_learned: str | None = None
    closure_date: date | None = None
    remarks: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    created_at: datetime
    updated_at: datetime


# --- Dependency ---


class DependencyLogCreate(BaseModel):
    dependency_title: str
    description: str | None = None
    dependency_type: DependencyType | None = None
    category: str | None = None
    depends_on: str | None = None
    related_task_milestone: str | None = None
    required_by_date: date | None = None
    owner: UUID | None = None
    criticality: Criticality | None = None
    impact_if_delayed: str | None = None
    probability_of_delay: ProbabilityOfDelay | None = None
    mitigation_plan: str | None = None
    escalation_required: bool = False
    escalation_level: DependencyEscalationLevel | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    remarks: str | None = None


class DependencyLogUpdate(BaseModel):
    dependency_title: str | None = None
    description: str | None = None
    dependency_type: DependencyType | None = None
    category: str | None = None
    depends_on: str | None = None
    related_task_milestone: str | None = None
    required_by_date: date | None = None
    owner: UUID | None = None
    dependency_status: DependencyStatus | None = None
    criticality: Criticality | None = None
    impact_if_delayed: str | None = None
    probability_of_delay: ProbabilityOfDelay | None = None
    mitigation_plan: str | None = None
    escalation_required: bool | None = None
    escalation_level: DependencyEscalationLevel | None = None
    actual_completion_date: date | None = None
    last_updated: date | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    remarks: str | None = None


class DependencyLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    dependency_code: str
    project_id: UUID
    dependency_title: str
    description: str | None = None
    dependency_type: DependencyType | None = None
    category: str | None = None
    depends_on: str | None = None
    related_task_milestone: str | None = None
    required_by_date: date | None = None
    owner: UUID | None = None
    dependency_status: DependencyStatus
    criticality: Criticality | None = None
    impact_if_delayed: str | None = None
    probability_of_delay: ProbabilityOfDelay | None = None
    mitigation_plan: str | None = None
    escalation_required: bool
    escalation_level: DependencyEscalationLevel | None = None
    actual_completion_date: date | None = None
    last_updated: date | None = None
    remarks: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    created_at: datetime
    updated_at: datetime


# --- Assumption ---


class AssumptionLogCreate(BaseModel):
    title: str
    detailed_description: str | None = None
    category: str | None = None
    raised_by: UUID | None = None
    raised_date: date | None = None
    owner: UUID | None = None
    dependency_reference: UUID | None = None
    impact_if_invalid: str | None = None
    probability_of_failure: ProbabilityOfFailure | None = None
    impact_rating: ImpactRating | None = None
    validation_date: date | None = None
    mitigation_plan: str | None = None
    contingency_plan: str | None = None
    remarks: str | None = None


class AssumptionLogUpdate(BaseModel):
    title: str | None = None
    detailed_description: str | None = None
    category: str | None = None
    owner: UUID | None = None
    dependency_reference: UUID | None = None
    impact_if_invalid: str | None = None
    probability_of_failure: ProbabilityOfFailure | None = None
    impact_rating: ImpactRating | None = None
    validation_date: date | None = None
    validation_status: ValidationStatus | None = None
    mitigation_plan: str | None = None
    contingency_plan: str | None = None
    current_status: AssumptionStatus | None = None
    last_updated: date | None = None
    remarks: str | None = None


class AssumptionLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    assumption_code: str
    project_id: UUID
    title: str
    detailed_description: str | None = None
    category: str | None = None
    raised_by: UUID | None = None
    raised_date: date | None = None
    owner: UUID | None = None
    dependency_reference: UUID | None = None
    impact_if_invalid: str | None = None
    probability_of_failure: ProbabilityOfFailure | None = None
    impact_rating: ImpactRating | None = None
    validation_date: date | None = None
    validation_status: ValidationStatus
    mitigation_plan: str | None = None
    contingency_plan: str | None = None
    current_status: AssumptionStatus
    last_updated: date | None = None
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Opportunity ---


class OpportunityLogCreate(BaseModel):
    opportunity_title: str
    opportunity_description: str | None = None
    category: str | None = None
    identified_by: UUID | None = None
    identified_date: date | None = None
    opportunity_owner: UUID | None = None
    impact: OpportunityImpact | None = None
    expected_benefit: ExpectedBenefit | None = None
    estimated_benefit: Decimal | None = None
    benefit_type: BenefitType | None = None
    exploitation_strategy: ExploitationStrategy | None = None
    action_plan: str | None = None
    target_implementation_date: date | None = None
    approval_required: bool = False
    last_review_date: date | None = None
    next_review_date: date | None = None
    remarks: str | None = None


class OpportunityLogUpdate(BaseModel):
    opportunity_title: str | None = None
    opportunity_description: str | None = None
    category: str | None = None
    opportunity_owner: UUID | None = None
    impact: OpportunityImpact | None = None
    expected_benefit: ExpectedBenefit | None = None
    estimated_benefit: Decimal | None = None
    benefit_type: BenefitType | None = None
    exploitation_strategy: ExploitationStrategy | None = None
    action_plan: str | None = None
    target_implementation_date: date | None = None
    status: OpportunityStatus | None = None
    approval_required: bool | None = None
    approved_by: UUID | None = None
    actual_benefit: Decimal | None = None
    closure_date: date | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    remarks: str | None = None


class OpportunityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    opportunity_code: str
    project_id: UUID
    opportunity_title: str
    opportunity_description: str | None = None
    category: str | None = None
    identified_by: UUID | None = None
    identified_date: date | None = None
    opportunity_owner: UUID | None = None
    impact: OpportunityImpact | None = None
    expected_benefit: ExpectedBenefit | None = None
    estimated_benefit: Decimal | None = None
    benefit_type: BenefitType | None = None
    exploitation_strategy: ExploitationStrategy | None = None
    action_plan: str | None = None
    target_implementation_date: date | None = None
    status: OpportunityStatus
    approval_required: bool
    approved_by: UUID | None = None
    actual_benefit: Decimal | None = None
    closure_date: date | None = None
    remarks: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    created_at: datetime
    updated_at: datetime
