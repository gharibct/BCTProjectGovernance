from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.enums import (
    ActionLevel,
    ActionPriority,
    ActionStatus,
    AssumptionStatus,
    Category,
    DependencyStatus,
    FindingStatus,
    HealthRating,
    Impact,
    IssueSeverity,
    IssueStatus,
    OpportunityImpact,
    OpportunityStatus,
    Probability,
    ProjectStatus,
    RiskSeverity,
    RiskStatus,
)


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


# Project Manager "My Summary" (design-reference/pm-mysummary.jpg) — a
# separate, PM-session-scoped aggregation rather than another DashboardSummary
# filter combination, since it needs shapes (Reports Due, RAIDO, My Open
# Actions) the generic dashboard has no use for.


class RaidoSummary(BaseModel):
    open_risks: int
    high_critical_risks: int
    open_issues: int
    dependencies: int


class ReportsDueSummary(BaseModel):
    due_count: int
    overdue_count: int


class AttentionItem(BaseModel):
    title: str
    subtitle: str
    href: str


class MyOpenActionRow(BaseModel):
    id: UUID
    title: str
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    account_name: str | None = None
    due_date: date
    overdue: bool
    due_this_week: bool
    priority: ActionPriority


class MyProjectHealthRow(HealthMatrixRow):
    # "Submitted" | "Draft" | "Due Today" | "Not Submitted" — see
    # services/dashboard.py's project_report_status.
    report_status: str


class MyDashboardSummary(BaseModel):
    my_projects_count: int
    projects_requiring_attention: int
    health_green: int
    health_amber: int
    health_potential_red: int
    health_red: int
    reports_due: ReportsDueSummary
    open_actions_count: int
    open_actions_overdue_count: int
    open_actions_high: int
    open_actions_medium: int
    open_actions_low: int
    open_findings_count: int
    attention_items: list[AttentionItem]
    raido: RaidoSummary
    project_health: list[MyProjectHealthRow]
    open_actions: list[MyOpenActionRow]


# Account Head "My Summary" (design-reference/acchead-mysummary.jpg) — the
# Account Manager role's counterpart to MyDashboardSummary above, scoped to
# the signed-in user's owned accounts (user_accounts) rather than a single
# project_manager_id. Adds a Report Review Queue (Submitted reports awaiting
# this Account Head's approve/reject) and per-account portfolio health, which
# have no PM "My Summary" equivalent.


class ReportReviewQueueRow(BaseModel):
    report_id: UUID
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    account_name: str | None = None
    project_manager_name: str | None
    period_label: str
    health: HealthRating | None
    submitted_at: datetime
    href: str


class AccountPortfolioHealthRow(BaseModel):
    account_id: UUID
    account_name: str
    active_projects_count: int
    health_green: int
    health_amber: int
    health_potential_red: int
    health_red: int
    status_label: str  # "On Track" | "At Risk" | "Critical" | "Not Rated"


class ReportingReadiness(BaseModel):
    ready_count: int
    total_count: int
    approved_count: int
    awaiting_review_count: int
    not_submitted_count: int
    rejected_count: int


class AccountHeadOpenActionRow(BaseModel):
    id: UUID
    title: str
    entity_label: str
    due_date: date
    overdue: bool
    due_this_week: bool
    href: str
    priority: ActionPriority


class AccountHeadDashboardSummary(BaseModel):
    accounts_count: int
    active_projects_count: int
    health_green: int
    health_amber: int
    health_potential_red: int
    health_red: int
    awaiting_review_count: int
    high_critical_risks_count: int
    open_actions_high: int
    open_actions_medium: int
    open_actions_low: int
    report_review_queue: list[ReportReviewQueueRow]
    account_portfolio_health: list[AccountPortfolioHealthRow]
    attention_items: list[AttentionItem]
    reporting_readiness: ReportingReadiness
    open_actions: list[AccountHeadOpenActionRow]


# Geo Head "My Summary" (design-reference/geohead-mysummary.jpg) — the Geo
# Head role's counterpart to AccountHeadDashboardSummary above, scoped to the
# signed-in user's owned geo(s) (user_geos) rather than owned accounts
# directly. Adds an Account Review Queue (Submitted AccountStatusReports
# awaiting this Geo Head's approve/reject, one level above the Account Head's
# own Project-report queue) and a categorized Critical Attention box, plus an
# Executive Update card backed by the existing executive_updates feature.


class AccountReviewQueueRow(BaseModel):
    account_id: UUID
    account_name: str
    account_head_name: str | None
    health: HealthRating | None
    submitted_at: datetime
    href: str


class GeoAttentionItem(BaseModel):
    category: str
    title: str
    subtitle: str
    href: str


class GeoExecutiveUpdateSummary(BaseModel):
    status: str
    description: str
    href: str


class GeoHeadDashboardSummary(BaseModel):
    accounts_count: int
    projects_count: int
    geo_health: HealthRating | None
    awaiting_review_count: int
    geo_report_due: bool
    open_actions_count: int
    account_review_queue: list[AccountReviewQueueRow]
    account_portfolio_health: list[AccountPortfolioHealthRow]
    critical_attention: list[GeoAttentionItem]
    reporting_readiness: ReportingReadiness
    executive_update: GeoExecutiveUpdateSummary | None
    open_actions: list[AccountHeadOpenActionRow]


# Delivery Excellence "My Summary" (design-reference/de-mysummary.jpg) — the
# DELIVERY_EXCELLENCE role's counterpart to the three summaries above, scoped
# to projects where the signed-in user is the assigned delivery_excellence_id
# (see Project model), not an owned account/geo. A DE assessment is independent
# of reporting periods: work is measured against the current calendar month —
# see services/dashboard.py's current_month_window.


class DEAssessmentWorkQueueRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    project_manager_name: str | None
    account_name: str | None
    geo_name: str | None = None
    region_name: str | None = None
    pm_health: HealthRating | None
    de_health: HealthRating | None  # from the most recent assessment this month
    pci_score: Decimal | None
    status: str  # "Assessed" | "Draft" | "Due" (this calendar month)
    assessments_this_month: int = 0
    last_assessment_date: date | None = None  # most recent assessment, any month
    assessed_by_name: str | None = None  # who filed the most recent assessment this month
    open_findings_count: int = 0
    prev_de_health: HealthRating | None = None  # latest Submitted assessment before this month
    prev_pci_score: Decimal | None = None
    href: str


class DEAssessmentCompletionSummary(BaseModel):
    completed_count: int
    total_count: int


class FindingClassificationBreakdownRow(BaseModel):
    classification: str
    count: int


class DEFindingsSummary(BaseModel):
    open_count: int
    overdue_count: int
    new_this_period_count: int
    closed_this_period_count: int
    by_classification: list[FindingClassificationBreakdownRow]


class DEDashboardSummary(BaseModel):
    period_id: UUID | None  # always None now — a DE assessment has no reporting period
    period_label: str | None  # the current calendar month, e.g. "August 2026"
    assessments_due_count: int
    pending_count: int = 0  # Due + Draft this month (design queue "PENDING" KPI)
    average_pci: float | None = None  # mean PCI across assessments filed this month
    completion: DEAssessmentCompletionSummary
    red_amber_assessed_count: int
    findings: DEFindingsSummary
    work_queue: list[DEAssessmentWorkQueueRow]
    attention_items: list[AttentionItem]


# PMO "My Summary" (design-reference/pmo-mysummary.jpg) — the PMO role's
# portfolio-wide counterpart to the scoped summaries above: every project org-
# wide (DashboardFilters() with nothing set), reduced to a single governance
# compliance view instead of a health/reporting rollup. No PMO login exists
# yet (the role is wired the same way the others are, ready for when it
# does) — see services/dashboard.py's pmo_governance_compliance_matrix.


class PmoReportingComplianceSummary(BaseModel):
    on_time_count: int
    late_count: int
    missing_count: int
    rework_count: int


class GovernanceExceptionRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    account_name: str | None
    exception: str
    age_days: int
    href: str


class GovernanceComplianceRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    reporting_status: str  # "Compliant" | "Minor Gap" | "Major Gap"
    measurement_status: str
    contractual_status: str
    raido_status: str
    assessment_status: str
    overall_status: str
    href: str


class PmoDashboardSummary(BaseModel):
    active_projects_count: int
    governance_compliance_pct: int
    reports_overdue_count: int
    assessments_overdue_count: int
    high_critical_risks_count: int
    overdue_actions_count: int
    reporting_compliance: PmoReportingComplianceSummary
    governance_exceptions: list[GovernanceExceptionRow]
    governance_compliance: list[GovernanceComplianceRow]


# Project Health dashboard (design-reference/Project-Health.html) — an
# org-wide, portfolio-level bento-grid of KPI cards for PMO/Admin/CXO, one
# card per business area (Portfolio, Health, the 5 RAIDO entities, Metrics,
# Commitments, Payment Milestones, Actions, Findings, DE Assessments, Data
# Integrity). See services/dashboard.py's "Project Health dashboard" section
# for how each of these is computed.


class ProjectPortfolioSummary(BaseModel):
    total_count: int
    active_count: int
    completed_count: int
    on_hold_count: int


class ProjectHealthCardSummary(BaseModel):
    green_count: int
    amber_count: int
    potential_red_count: int
    red_count: int
    reporting_overdue_count: int


# Account-level RAG rollup — the same green/amber/potential-red/red/reporting-
# overdue shape as ProjectHealthCardSummary, but off the latest
# AccountHealthDeclaration per in-scope account (rather than per project) and
# AccountStatusReport for the overdue count.
class AccountRagCardSummary(BaseModel):
    green_count: int
    amber_count: int
    potential_red_count: int
    red_count: int
    reporting_overdue_count: int


class RiskCardSummary(BaseModel):
    open_count: int
    high_critical_count: int
    overdue_count: int
    no_mitigation_count: int


class IssueCardSummary(BaseModel):
    open_count: int
    critical_count: int
    overdue_count: int
    aging_over_threshold_count: int


class DependencyCardSummary(BaseModel):
    open_count: int
    overdue_count: int
    critical_count: int


class AssumptionCardSummary(BaseModel):
    open_count: int
    review_due_count: int
    overdue_count: int


class OpportunityCardSummary(BaseModel):
    open_count: int
    high_priority_count: int
    pending_approval_count: int


class MetricsComplianceSummary(BaseModel):
    compliant_pct: int
    below_target_count: int
    not_reported_count: int
    critical_variance_count: int


class CommitmentsCardSummary(BaseModel):
    open_count: int
    due_soon_count: int
    overdue_count: int
    breached_count: int


class PaymentMilestonesCardSummary(BaseModel):
    value_due: Decimal
    due_count: int
    overdue_count: int


class ActionsCardSummary(BaseModel):
    open_count: int
    in_progress_count: int
    overdue_count: int
    due_this_week_count: int


class FindingsCardSummary(BaseModel):
    open_count: int
    new_this_period_count: int
    overdue_count: int
    awaiting_closure_count: int


class DEAssessmentsCardSummary(BaseModel):
    completed_count: int
    avg_pci_score: Decimal | None
    due_count: int
    red_amber_count: int


class DataIntegrityCardSummary(BaseModel):
    overall_compliance_pct: int
    projects_with_gaps_count: int
    critical_gaps_count: int


# Row shapes for the Project Health drill-down list screens (Project List,
# RAG, Risks, Issues — design-reference/project-health-screens.md). Plain
# joined-display-name rows, not ProjectRead/RiskLogRead/IssueLogRead, since
# the grids need names (geo/account/owner) rather than raw FK ids.


class ProjectListRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    project_type_name: str | None = None
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    project_manager_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    overall_health: HealthRating | None = None
    status: ProjectStatus


class RagRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    overall_rating: HealthRating | None = None
    core_delivery_rating: HealthRating | None = None
    operational_rating: HealthRating | None = None
    financial_rating: HealthRating | None = None
    period_label: str | None = None
    last_updated: datetime | None = None


class AccountRagRow(BaseModel):
    """One account's latest Account Health Declaration, fully broken out —
    the account-level sibling of RagRow, behind the Project Health
    dashboard's "Account Health -> View Account RAG" drill-down."""

    account_id: UUID
    account_name: str
    geo_name: str | None = None
    project_count: int
    overall_rating: HealthRating | None = None
    core_delivery_rating: HealthRating | None = None
    people_rating: HealthRating | None = None
    operational_rating: HealthRating | None = None
    customer_rating: HealthRating | None = None
    financial_rating: HealthRating | None = None
    compliance_rating: HealthRating | None = None
    period_label: str | None = None
    last_updated: datetime | None = None


class RiskRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    risk_id: UUID
    risk_title: str
    risk_category: Category | None = None
    probability: Probability | None = None
    impact: Impact | None = None
    severity: RiskSeverity | None = None
    mitigation_plan: str | None = None
    owner_name: str | None = None
    target_resolution_date: date | None = None
    current_status: RiskStatus


class IssueRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    issue_id: UUID
    issue_title: str
    issue_category: str | None = None
    severity: IssueSeverity | None = None
    owner_name: str | None = None
    due_date: date | None = None
    age_days: int | None = None
    status: IssueStatus


class DependencyRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    dependency_id: UUID
    dependency_title: str
    category: str | None = None
    depends_on: str | None = None
    owner_name: str | None = None
    due_date: date | None = None
    status: DependencyStatus


class AssumptionRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    assumption_id: UUID
    title: str
    owner_name: str | None = None
    review_date: date | None = None
    status: AssumptionStatus


class OpportunityRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    opportunity_id: UUID
    opportunity_title: str
    category: str | None = None
    priority: OpportunityImpact | None = None
    owner_name: str | None = None
    target_date: date | None = None
    status: OpportunityStatus


class MetricRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    metric_name: str
    target: str | None = None
    actual: str | None = None
    variance: str | None = None
    status: str
    period_label: str | None = None


class CommitmentRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    commitment_id: UUID
    commitment_name: str
    type: str
    owner_name: str | None = None
    due_date: date | None = None
    actual_date: date | None = None
    status: str


class PaymentMilestoneRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    milestone_id: UUID
    milestone_name: str
    amount: Decimal | None = None
    currency: str | None = None
    planned_date: date | None = None
    actual_date: date | None = None
    status: str


class AssessmentRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    assessment_id: UUID
    pm_health: HealthRating | None = None
    de_health: HealthRating | None = None
    pci_score: Decimal | None = None
    assessment_period: str | None = None
    assessed_by_name: str | None = None
    status: str


class FindingRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    finding_id: UUID
    finding_title: str
    classification: str
    action_taken: str | None = None
    owner_name: str | None = None
    due_date: date | None = None
    age_days: int | None = None
    status: FindingStatus


class ActionRow(BaseModel):
    action_id: UUID
    level: ActionLevel
    scope_label: str
    title: str
    assigned_to_name: str | None = None
    due_date: date
    age_days: int
    status: ActionStatus


class DataIntegrityRow(BaseModel):
    project_id: UUID
    project_label: str
    geo_name: str | None = None
    region_name: str | None = None
    account_name: str | None = None
    item_id: UUID
    check_name: str
    category: str
    status: str
    issue: str | None = None
    last_checked: date | None = None


class ProjectHealthDashboardSummary(BaseModel):
    portfolio: ProjectPortfolioSummary
    health: ProjectHealthCardSummary
    account_health: AccountRagCardSummary
    risks: RiskCardSummary
    issues: IssueCardSummary
    dependencies: DependencyCardSummary
    assumptions: AssumptionCardSummary
    opportunities: OpportunityCardSummary
    metrics: MetricsComplianceSummary
    commitments: CommitmentsCardSummary
    payment_milestones: PaymentMilestonesCardSummary
    actions: ActionsCardSummary
    findings: FindingsCardSummary
    de_assessments: DEAssessmentsCardSummary
    data_integrity: DataIntegrityCardSummary
    period_id: UUID | None
    period_label: str | None
