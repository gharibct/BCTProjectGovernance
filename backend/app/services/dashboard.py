"""Dashboard (UX §4.2) — a live aggregation over every other module, not its
own stored data. Grouping/rollup math that's awkward as pure SQL (account
health 'worst wins' across a variable number of projects) is done in Python
after a narrow query, since portfolio sizes for an internal PMO tool are small.
"""

from calendar import monthrange
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import NamedTuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account_health_declarations import AccountHealthDeclaration
from app.models.actions import Action
from app.models.contractual import (
    ContractualCommitment,
    ContractualCommitmentActual,
    MilestonePayment,
    MilestonePaymentActual,
)
from app.models.data_integrity import DataIntegrityChecklistItem
from app.models.de_assessment import DEAssessment, DEAssessmentAlert, DEAssessmentFinding
from app.models.executive_updates import ExecutiveUpdate
from app.models.geo_health_declarations import GeoHealthDeclaration
from app.models.health_declarations import HealthDeclaration
from app.models.measurement import (
    MeasurementCloudMaintenance,
    MeasurementCloudMigration,
    MeasurementDevelopment,
    MeasurementStaffing,
    MeasurementSupport,
    MeasurementTesting,
)
from app.models.metric_target import (
    MetricTargetCloudMaintenance,
    MetricTargetCloudMigration,
    MetricTargetDevelopment,
    MetricTargetStaffing,
    MetricTargetSupport,
    MetricTargetTesting,
)
from app.models.project_status import ProjectStatusItem, ProjectStatusReport
from app.models.projects import Project
from app.models.raid import AssumptionLog, DependencyLog, IssueLog, OpportunityLog, RiskLog
from app.models.reference_data import Account, Geo, ProjectType, Region, ReportingPeriod
from app.models.regional_status import AccountStatusItem, AccountStatusReport, GeoStatusReport
from app.models.users import User, UserAccount
from app.schemas.dashboard import (
    AccountHealthRow,
    AccountPortfolioHealthRow,
    AccountRagCardSummary,
    AccountRagRow,
    AccountReviewQueueRow,
    ActionRow,
    ActionsCardSummary,
    AssessmentRow,
    AssumptionCardSummary,
    AssumptionRow,
    AttentionItem,
    CommitmentRow,
    CommitmentsCardSummary,
    ContractualComplianceSummary,
    DataIntegrityCardSummary,
    DataIntegrityRow,
    DEAssessmentCompletionSummary,
    DEAssessmentsCardSummary,
    DEAssessmentWorkQueueRow,
    DEFindingsSummary,
    DependencyCardSummary,
    DependencyRow,
    FindingClassificationBreakdownRow,
    FindingRow,
    FindingsCardSummary,
    GeoAttentionItem,
    GeoExecutiveUpdateSummary,
    GovernanceComplianceRow,
    GovernanceExceptionRow,
    HealthMatrixRow,
    HighlightRow,
    IssueCardSummary,
    IssueRow,
    MetricRow,
    MetricsComplianceSummary,
    MilestonePaymentSummary,
    MyOpenActionRow,
    MyProjectHealthRow,
    AccountHeadOpenActionRow,
    OpportunityCardSummary,
    OpportunityRow,
    PaymentMilestoneRow,
    PaymentMilestonesCardSummary,
    PmoReportingComplianceSummary,
    ProjectHealthCardSummary,
    ProjectHealthRow,
    ProjectListRow,
    ProjectPortfolioSummary,
    ProjectTypeBreakdownRow,
    RagRow,
    RaidoSummary,
    ReportingReadiness,
    ReportReviewQueueRow,
    ReportsDueSummary,
    RiskCardSummary,
    RiskRow,
)
from app.schemas.enums import (
    ActionLevel,
    ActionPriority,
    ActionStatus,
    AssumptionStatus,
    Criticality,
    DependencyStatus,
    FindingStatus,
    HealthRating,
    IssueSeverity,
    IssueStatus,
    OpportunityImpact,
    OpportunityStatus,
    ProjectLifecycleStatus,
    ReportStatus,
    RiskSeverity,
    RiskStatus,
    ValidationStatus,
)
from app.services import data_integrity_rollup
from app.services.health_rollup import compute_overall_rating


@dataclass
class DashboardFilters:
    geo_id: UUID | None = None
    account_id: UUID | None = None
    project_type_id: UUID | None = None
    health_status: HealthRating | None = None
    # Role-scoping for the Geo Head / Account Manager dashboards — a user can
    # own more than one geo/account (see user_geos/user_accounts), so these
    # are separate from the single-value filters above used by the generic
    # Dashboard page's manual filter dropdown.
    geo_ids: list[UUID] | None = None
    account_ids: list[UUID] | None = None
    # PM "My Summary" scoping (design-reference/pm-mysummary.jpg) — set from
    # the signed-in user's id server-side, never a client-supplied query
    # param (see dashboard.py's get_my_dashboard_summary).
    project_manager_id: UUID | None = None
    # Delivery Excellence "My Summary" scoping (design-reference/de-mysummary.jpg)
    # — same server-side-only convention as project_manager_id above.
    delivery_excellence_id: UUID | None = None


def _project_conditions(filters: DashboardFilters) -> list:
    conditions = []
    if filters.geo_id is not None:
        conditions.append(Project.geo_id == filters.geo_id)
    if filters.account_id is not None:
        conditions.append(Project.account_id == filters.account_id)
    if filters.geo_ids is not None:
        conditions.append(Project.geo_id.in_(filters.geo_ids))
    if filters.account_ids is not None:
        conditions.append(Project.account_id.in_(filters.account_ids))
    if filters.project_type_id is not None:
        conditions.append(Project.project_type_id == filters.project_type_id)
    if filters.health_status is not None:
        conditions.append(Project.overall_project_health == filters.health_status)
    if filters.project_manager_id is not None:
        conditions.append(Project.project_manager_id == filters.project_manager_id)
    if filters.delivery_excellence_id is not None:
        conditions.append(Project.delivery_excellence_id == filters.delivery_excellence_id)
    return conditions


async def _matching_project_ids(db: AsyncSession, filters: DashboardFilters):
    conditions = _project_conditions(filters)
    stmt = select(Project.id).where(*conditions) if conditions else select(Project.id)
    return stmt


async def count_active_projects(db: AsyncSession, filters: DashboardFilters) -> int:
    conditions = [
        *_project_conditions(filters),
        Project.lifecycle_status.is_distinct_from(ProjectLifecycleStatus.CLOSED.value),
    ]
    return (await db.execute(select(func.count()).select_from(Project).where(*conditions))).scalar_one()


async def projects_by_type(db: AsyncSession, filters: DashboardFilters) -> list[ProjectTypeBreakdownRow]:
    conditions = _project_conditions(filters)
    stmt = (
        select(ProjectType.id, ProjectType.name, func.count(Project.id))
        .select_from(Project)
        .outerjoin(ProjectType, ProjectType.id == Project.project_type_id)
        .where(*conditions)
        .group_by(ProjectType.id, ProjectType.name)
    )
    rows = (await db.execute(stmt)).all()
    return [ProjectTypeBreakdownRow(project_type_id=r[0], project_type_name=r[1], count=r[2]) for r in rows]


async def count_delayed_projects(db: AsyncSession, filters: DashboardFilters) -> int:
    conditions = [
        *_project_conditions(filters),
        Project.planned_end_date.is_not(None),
        Project.planned_end_date < date.today(),
        Project.actual_end_date.is_(None),
        Project.lifecycle_status.is_distinct_from(ProjectLifecycleStatus.CLOSED.value),
    ]
    return (await db.execute(select(func.count()).select_from(Project).where(*conditions))).scalar_one()


async def count_open_risks(db: AsyncSession, filters: DashboardFilters) -> int:
    project_ids = await _matching_project_ids(db, filters)
    stmt = (
        select(func.count())
        .select_from(RiskLog)
        .where(RiskLog.project_id.in_(project_ids), RiskLog.current_status.in_(["Open", "Monitoring"]))
    )
    return (await db.execute(stmt)).scalar_one()


async def count_open_issues(db: AsyncSession, filters: DashboardFilters) -> int:
    project_ids = await _matching_project_ids(db, filters)
    stmt = (
        select(func.count())
        .select_from(IssueLog)
        .where(IssueLog.project_id.in_(project_ids), IssueLog.status.not_in(["Resolved", "Closed"]))
    )
    return (await db.execute(stmt)).scalar_one()


async def _pending_opportunities_count(db: AsyncSession, project_ids) -> int:
    stmt = (
        select(func.count())
        .select_from(OpportunityLog)
        .where(
            OpportunityLog.project_id.in_(project_ids),
            OpportunityLog.approval_required.is_(True),
            OpportunityLog.status == "Identified",
        )
    )
    return (await db.execute(stmt)).scalar_one()


async def count_pending_approvals(db: AsyncSession, filters: DashboardFilters) -> int:
    """Opportunities awaiting approval + DE alerts on a project's most recent
    assessment where health still isn't Green (no explicit alert status field
    in the source schema, so 'open' is inferred as 'not yet superseded by a
    later Green assessment')."""

    project_ids = await _matching_project_ids(db, filters)
    pending_opportunities = await _pending_opportunities_count(db, project_ids)

    latest_assessment_dates = (
        select(DEAssessment.project_id, func.max(DEAssessment.assessment_date).label("latest_date"))
        .where(DEAssessment.project_id.in_(project_ids))
        .group_by(DEAssessment.project_id)
        .subquery()
    )
    open_alerts_stmt = (
        select(func.count())
        .select_from(DEAssessmentAlert)
        .join(DEAssessment, DEAssessment.id == DEAssessmentAlert.assessment_id)
        .join(
            latest_assessment_dates,
            (DEAssessment.project_id == latest_assessment_dates.c.project_id)
            & (DEAssessment.assessment_date == latest_assessment_dates.c.latest_date),
        )
        .where(DEAssessment.de_assessed_project_health != HealthRating.GREEN)
    )
    open_alerts = (await db.execute(open_alerts_stmt)).scalar_one()

    return pending_opportunities + open_alerts


async def project_health_rows(db: AsyncSession, filters: DashboardFilters) -> list[ProjectHealthRow]:
    conditions = _project_conditions(filters)
    stmt = (
        select(
            Project.id,
            Project.project_code,
            Project.project_name,
            Project.overall_project_health,
            Project.account_id,
            Account.name,
        )
        .outerjoin(Account, Account.id == Project.account_id)
        .where(*conditions)
    )
    rows = (await db.execute(stmt)).all()
    return [
        ProjectHealthRow(
            project_id=r[0],
            project_code=r[1],
            project_name=r[2],
            overall_project_health=r[3],
            account_id=r[4],
            account_name=r[5],
        )
        for r in rows
    ]


def _account_conditions(filters: DashboardFilters) -> list:
    conditions = []
    if filters.geo_id is not None:
        conditions.append(Account.geo_id == filters.geo_id)
    if filters.geo_ids is not None:
        conditions.append(Account.geo_id.in_(filters.geo_ids))
    if filters.account_id is not None:
        conditions.append(Account.id == filters.account_id)
    if filters.account_ids is not None:
        conditions.append(Account.id.in_(filters.account_ids))
    return conditions


async def account_health_rows(db: AsyncSession, filters: DashboardFilters) -> list[AccountHealthRow]:
    # Candidate accounts are scoped directly off Account (geo/account_id),
    # not derived from having any Project rows — an account with a submitted
    # status report or health declaration but zero projects (e.g. a brand
    # new account) must still appear here, just with project_count=0,
    # instead of silently vanishing from every screen built on this (the
    # Governance Matrix, Top Highlights, ...).
    account_conditions = _account_conditions(filters)
    accounts_stmt = select(Account.id, Account.name).where(*account_conditions) if account_conditions else select(
        Account.id, Account.name
    )
    account_names: dict[UUID, str] = dict((await db.execute(accounts_stmt)).all())
    if not account_names:
        return []

    conditions = [*_project_conditions(filters), Project.account_id.in_(account_names.keys())]
    stmt = select(Project.account_id, Project.overall_project_health).where(*conditions)
    rows = (await db.execute(stmt)).all()

    by_account: dict[UUID, list[HealthRating]] = defaultdict(list)
    counts: dict[UUID, int] = defaultdict(int)
    for account_id, health in rows:
        counts[account_id] += 1
        if health is not None:
            by_account[account_id].append(health)

    return [
        AccountHealthRow(
            account_id=account_id,
            account_name=name,
            overall_health=compute_overall_rating(by_account[account_id]) if by_account.get(account_id) else None,
            project_count=counts.get(account_id, 0),
        )
        for account_id, name in account_names.items()
    ]


async def contractual_compliance_summary(db: AsyncSession, filters: DashboardFilters) -> ContractualComplianceSummary:
    project_ids = await _matching_project_ids(db, filters)

    latest_actual_dates = (
        select(
            ContractualCommitmentActual.commitment_id,
            func.max(ContractualCommitmentActual.period_date).label("latest_date"),
        )
        .group_by(ContractualCommitmentActual.commitment_id)
        .subquery()
    )
    latest_status_stmt = (
        select(ContractualCommitmentActual.met_status)
        .join(
            latest_actual_dates,
            (ContractualCommitmentActual.commitment_id == latest_actual_dates.c.commitment_id)
            & (ContractualCommitmentActual.period_date == latest_actual_dates.c.latest_date),
        )
        .join(ContractualCommitment, ContractualCommitment.id == ContractualCommitmentActual.commitment_id)
        .where(ContractualCommitment.project_id.in_(project_ids))
    )
    statuses = [row[0] for row in (await db.execute(latest_status_stmt)).all()]

    total_commitments = (
        await db.execute(
            select(func.count())
            .select_from(ContractualCommitment)
            .where(ContractualCommitment.project_id.in_(project_ids))
        )
    ).scalar_one()

    met_count = sum(1 for s in statuses if s == "Met")
    # "Breached" is a stronger form of non-compliance — count it alongside "Not Met".
    not_met_count = sum(1 for s in statuses if s in ("Not Met", "Breached"))
    return ContractualComplianceSummary(
        met_count=met_count,
        not_met_count=not_met_count,
        not_yet_recorded_count=total_commitments - len(statuses),
    )


async def milestone_payment_summary(db: AsyncSession, filters: DashboardFilters) -> MilestonePaymentSummary:
    project_ids = await _matching_project_ids(db, filters)

    stmt = (
        select(MilestonePayment.expected_date_of_payment, MilestonePaymentActual.actual_date_of_payment)
        .select_from(MilestonePayment)
        .outerjoin(MilestonePaymentActual, MilestonePaymentActual.milestone_id == MilestonePayment.id)
        .where(MilestonePayment.project_id.in_(project_ids))
    )
    rows = (await db.execute(stmt)).all()

    today = date.today()
    upcoming = overdue = paid = 0
    for expected_date, actual_date in rows:
        if actual_date is not None:
            paid += 1
        elif expected_date is not None and expected_date < today:
            overdue += 1
        else:
            upcoming += 1

    return MilestonePaymentSummary(upcoming_count=upcoming, overdue_count=overdue, paid_count=paid)


# Governance Matrix (CXO/Geo Head/Account Manager dashboard redesign) — full
# 6-category breakdown per account/project, unlike account_health_rows'/
# project_health_rows' single rolled-up overall_health. No bulk "latest
# declaration per entity" query exists elsewhere, so this fetches every
# matching declaration for the in-scope id set in one query and reduces to
# the latest per entity by created_at in Python (no window functions/DISTINCT
# ON, staying portable across this app's Postgres/SQLite dual setup — same
# approach this module's docstring already endorses for grouping math).


async def account_health_matrix(db: AsyncSession, filters: DashboardFilters) -> list[HealthMatrixRow]:
    accounts = await account_health_rows(db, filters)
    if not accounts:
        return []
    account_ids = [a.account_id for a in accounts]

    declarations = (
        await db.execute(select(AccountHealthDeclaration).where(AccountHealthDeclaration.account_id.in_(account_ids)))
    ).scalars().all()
    latest: dict[UUID, AccountHealthDeclaration] = {}
    for decl in declarations:
        current = latest.get(decl.account_id)
        if current is None or decl.created_at > current.created_at:
            latest[decl.account_id] = decl

    rows = [
        HealthMatrixRow(
            entity_id=a.account_id,
            entity_label=a.account_name,
            core_delivery_rating=latest[a.account_id].core_delivery_rating if a.account_id in latest else None,
            people_rating=latest[a.account_id].people_rating if a.account_id in latest else None,
            operational_rating=latest[a.account_id].operational_rating if a.account_id in latest else None,
            customer_rating=latest[a.account_id].customer_rating if a.account_id in latest else None,
            financial_rating=latest[a.account_id].financial_rating if a.account_id in latest else None,
            compliance_rating=latest[a.account_id].compliance_rating if a.account_id in latest else None,
            overall_rating=latest[a.account_id].overall_rating if a.account_id in latest else None,
        )
        for a in accounts
    ]
    return sorted(rows, key=lambda r: r.entity_label)


async def project_health_matrix(db: AsyncSession, filters: DashboardFilters) -> list[HealthMatrixRow]:
    projects = await project_health_rows(db, filters)
    if not projects:
        return []
    project_ids = [p.project_id for p in projects]

    declarations = (
        await db.execute(select(HealthDeclaration).where(HealthDeclaration.project_id.in_(project_ids)))
    ).scalars().all()
    latest: dict[UUID, HealthDeclaration] = {}
    for decl in declarations:
        current = latest.get(decl.project_id)
        if current is None or decl.created_at > current.created_at:
            latest[decl.project_id] = decl

    rows = [
        HealthMatrixRow(
            entity_id=p.project_id,
            entity_label=f"{p.project_code} · {p.project_name}",
            account_id=p.account_id,
            account_name=p.account_name,
            core_delivery_rating=latest[p.project_id].core_delivery_rating if p.project_id in latest else None,
            people_rating=latest[p.project_id].people_rating if p.project_id in latest else None,
            operational_rating=latest[p.project_id].operational_rating if p.project_id in latest else None,
            customer_rating=latest[p.project_id].customer_rating if p.project_id in latest else None,
            financial_rating=latest[p.project_id].financial_rating if p.project_id in latest else None,
            compliance_rating=latest[p.project_id].compliance_rating if p.project_id in latest else None,
            overall_rating=latest[p.project_id].overall_rating if p.project_id in latest else None,
        )
        for p in projects
    ]
    return sorted(rows, key=lambda r: r.entity_label)


async def account_highlights(db: AsyncSession, filters: DashboardFilters, limit: int = 5) -> list[HighlightRow]:
    accounts = await account_health_rows(db, filters)
    if not accounts:
        return []
    names = {a.account_id: a.account_name for a in accounts}

    stmt = (
        select(AccountStatusItem)
        .where(AccountStatusItem.account_id.in_(names.keys()))
        .order_by(AccountStatusItem.created_at.desc())
        .limit(limit)
    )
    items = (await db.execute(stmt)).scalars().all()
    return [
        HighlightRow(
            entity_id=item.account_id,
            entity_label=names.get(item.account_id, "Unknown"),
            category=item.category,
            description=item.description,
            created_at=item.created_at,
        )
        for item in items
    ]


async def project_highlights(db: AsyncSession, filters: DashboardFilters, limit: int = 5) -> list[HighlightRow]:
    projects = await project_health_rows(db, filters)
    if not projects:
        return []
    labels = {p.project_id: f"{p.project_code} · {p.project_name}" for p in projects}

    stmt = (
        select(ProjectStatusItem)
        .where(ProjectStatusItem.project_id.in_(labels.keys()))
        .order_by(ProjectStatusItem.created_at.desc())
        .limit(limit)
    )
    items = (await db.execute(stmt)).scalars().all()
    return [
        HighlightRow(
            entity_id=item.project_id,
            entity_label=labels.get(item.project_id, "Unknown"),
            category=item.category,
            description=item.description,
            created_at=item.created_at,
        )
        for item in items
    ]


# Project Manager "My Summary" (design-reference/pm-mysummary.jpg) — every
# helper below is called with filters.project_manager_id set, so
# project_health_rows(db, filters) above already returns exactly "my
# projects"; each function here re-fetches it once and lets callers pass it
# in to avoid repeating that query.


async def count_high_critical_risks(db: AsyncSession, filters: DashboardFilters) -> int:
    project_ids = await _matching_project_ids(db, filters)
    stmt = (
        select(func.count())
        .select_from(RiskLog)
        .where(
            RiskLog.project_id.in_(project_ids),
            RiskLog.current_status.in_(["Open", "Monitoring"]),
            RiskLog.severity.in_([RiskSeverity.HIGH, RiskSeverity.CRITICAL]),
        )
    )
    return (await db.execute(stmt)).scalar_one()


async def count_open_dependencies(db: AsyncSession, filters: DashboardFilters) -> int:
    project_ids = await _matching_project_ids(db, filters)
    stmt = (
        select(func.count())
        .select_from(DependencyLog)
        .where(DependencyLog.project_id.in_(project_ids), DependencyLog.dependency_status != DependencyStatus.COMPLETED)
    )
    return (await db.execute(stmt)).scalar_one()


async def _active_reporting_periods(db: AsyncSession) -> list[ReportingPeriod]:
    return (await db.execute(select(ReportingPeriod).where(ReportingPeriod.is_active.is_(True)))).scalars().all()


# One row per (in-scope project, active reporting period) pair that doesn't
# yet have a Submitted/Approved status report — "due" reuses the existing
# reporting_periods/project_status_reports mechanism instead of inventing a
# new cadence concept the schema doesn't have. A pair only counts once the
# period has actually started (no future periods) and only for periods that
# begin on/after the project's start date — nothing was owed for periods
# that ended before the project existed.
async def _reports_due_rows(
    db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow]
) -> list[dict]:
    if not projects:
        return []
    periods = await _active_reporting_periods(db)
    if not periods:
        return []
    project_ids = [p.project_id for p in projects]
    period_ids = [p.id for p in periods]

    start_by_project: dict[UUID, date | None] = dict(
        (
            await db.execute(
                select(
                    Project.id,
                    func.coalesce(Project.actual_start_date, Project.planned_start_date),
                ).where(Project.id.in_(project_ids))
            )
        ).all()
    )

    reports = (
        await db.execute(
            select(ProjectStatusReport).where(
                ProjectStatusReport.project_id.in_(project_ids),
                ProjectStatusReport.period_id.in_(period_ids),
            )
        )
    ).scalars().all()
    submitted = {
        (r.project_id, r.period_id) for r in reports if r.status in (ReportStatus.SUBMITTED, ReportStatus.APPROVED)
    }

    today = date.today()
    rows = []
    for project in projects:
        project_start = start_by_project.get(project.project_id)
        for period in periods:
            if period.start_date > today:
                continue  # period hasn't started yet — reporting only runs "till current date"
            if project_start is not None and period.start_date < project_start:
                continue  # period begins before the project started — no report was owed
            if (project.project_id, period.id) in submitted:
                continue
            rows.append(
                {
                    "project_id": project.project_id,
                    "project_label": f"{project.project_code} · {project.project_name}",
                    "period": period,
                    "overdue": period.end_date < today,
                }
            )
    return rows


async def reports_due_summary(db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow]) -> ReportsDueSummary:
    rows = await _reports_due_rows(db, filters, projects)
    overdue = sum(1 for r in rows if r["overdue"])
    return ReportsDueSummary(due_count=len(rows), overdue_count=overdue)


# One status label per project for the "My Projects Health" Report Status
# column — reduced from the nearest (soonest-ending, i.e. most urgent) active
# period's report, since a project can have more than one active period
# (Weekly + Monthly) at once but the mockup shows a single badge per row.
async def project_report_status(
    db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow]
) -> dict[UUID, str]:
    if not projects:
        return {}
    periods = await _active_reporting_periods(db)
    if not periods:
        return {p.project_id: "Not Submitted" for p in projects}
    nearest_period = min(periods, key=lambda p: p.end_date)
    project_ids = [p.project_id for p in projects]

    reports = (
        await db.execute(
            select(ProjectStatusReport).where(
                ProjectStatusReport.project_id.in_(project_ids),
                ProjectStatusReport.period_id == nearest_period.id,
            )
        )
    ).scalars().all()
    by_project = {r.project_id: r for r in reports}

    today = date.today()
    statuses: dict[UUID, str] = {}
    for project in projects:
        report = by_project.get(project.project_id)
        if report is not None and report.status == ReportStatus.DRAFT:
            statuses[project.project_id] = "Draft"
        elif report is not None and report.status in (ReportStatus.SUBMITTED, ReportStatus.APPROVED):
            statuses[project.project_id] = "Submitted"
        elif nearest_period.end_date == today:
            statuses[project.project_id] = "Due Today"
        else:
            statuses[project.project_id] = "Not Submitted"
    return statuses


# "Attention Required" banner — top not-submitted/overdue reports plus
# projects with overdue Actions, newest/most-urgent first. Deliberately not a
# generic "highlights" feed (unlike account_highlights/project_highlights
# above): the mockup's two example rows are specifically reporting- and
# action-shaped, not status-item-shaped.
async def attention_required(
    db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow], limit: int = 5
) -> tuple[list[AttentionItem], int]:
    """Returns (top `limit` items for the banner, count of distinct projects
    behind every item found — not just the ones that fit under `limit`) for
    the MY PROJECTS tile's "N require attention" line."""
    if not projects:
        return [], 0
    labels = {p.project_id: f"{p.project_code} · {p.project_name}" for p in projects}
    project_ids = list(labels.keys())
    today = date.today()

    items: list[AttentionItem] = []
    affected_projects: set[UUID] = set()
    seen_report_projects: set[UUID] = set()
    for row in await _reports_due_rows(db, filters, projects):
        if not row["overdue"] or row["project_id"] in seen_report_projects:
            continue
        seen_report_projects.add(row["project_id"])
        affected_projects.add(row["project_id"])
        days_late = (today - row["period"].end_date).days
        items.append(
            AttentionItem(
                title=f"{row['project_label']} reporting not submitted",
                subtitle=f"Due {days_late} day{'s' if days_late != 1 else ''} ago",
                href=f"/project-review/{row['project_id']}",
            )
        )

    overdue_actions_stmt = (
        select(Action.level_value, func.count())
        .where(
            Action.level == ActionLevel.PROJECT,
            Action.level_value.in_([str(pid) for pid in project_ids]),
            Action.status.not_in([ActionStatus.COMPLETED, ActionStatus.CLOSED, ActionStatus.CANCELLED]),
            Action.due_date < today,
        )
        .group_by(Action.level_value)
    )
    for level_value, count in (await db.execute(overdue_actions_stmt)).all():
        project_id = UUID(level_value)
        affected_projects.add(project_id)
        items.append(
            AttentionItem(
                title=f"{count} Overdue action{'s' if count != 1 else ''} in {labels.get(project_id, 'Unknown project')}",
                subtitle="Assignee: Various",
                href=f"/project-review/{project_id}",
            )
        )

    return items[:limit], len(affected_projects)


# Cross-project "My Open Actions" — Action Tracker (actions.py) is per-entity
# only (one router per Geo/Account/Project), so this is the one place that
# fans an Action query out across every in-scope project for a single owner.
async def my_open_actions(
    db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow], current_user_id: UUID
) -> list[MyOpenActionRow]:
    if not projects:
        return []
    labels = {p.project_id: f"{p.project_code} · {p.project_name}" for p in projects}
    project_ids = list(labels.keys())

    stmt = (
        select(Action)
        .where(
            Action.level == ActionLevel.PROJECT,
            Action.level_value.in_([str(pid) for pid in project_ids]),
            Action.action_by_id == current_user_id,
            Action.status.in_([ActionStatus.OPEN, ActionStatus.IN_PROGRESS]),
        )
        .order_by(Action.due_date)
    )
    actions = (await db.execute(stmt)).scalars().all()

    today = date.today()
    week_out = today + timedelta(days=7)
    rows = []
    for a in actions:
        project_id = UUID(a.level_value)
        rows.append(
            MyOpenActionRow(
                id=a.id,
                title=a.title,
                project_id=project_id,
                project_label=labels.get(project_id, "Unknown project"),
                due_date=a.due_date,
                overdue=a.due_date < today,
                due_this_week=today <= a.due_date <= week_out,
                priority=a.priority,
            )
        )
    return rows


def open_action_priority_split(actions: list[MyOpenActionRow] | list[AccountHeadOpenActionRow]) -> tuple[int, int, int]:
    """(high, medium, low) counts off Action.priority — CRITICAL buckets
    into High, since the KPI tile only has 3 colors (like health_split)."""
    high = medium = low = 0
    for a in actions:
        if a.priority in (ActionPriority.CRITICAL, ActionPriority.HIGH):
            high += 1
        elif a.priority == ActionPriority.MEDIUM:
            medium += 1
        elif a.priority == ActionPriority.LOW:
            low += 1
    return high, medium, low


def health_split(project_matrix: list[HealthMatrixRow]) -> tuple[int, int, int, int]:
    """(green, amber, potential_red, red) counts off the same overall_rating
    the health table shows — one bucket per RAG value, best-to-worst."""
    green = amber = potential_red = red = 0
    for row in project_matrix:
        if row.overall_rating == HealthRating.GREEN:
            green += 1
        elif row.overall_rating == HealthRating.AMBER:
            amber += 1
        elif row.overall_rating == HealthRating.POTENTIAL_RED:
            potential_red += 1
        elif row.overall_rating == HealthRating.RED:
            red += 1
    return green, amber, potential_red, red


def to_my_project_health_rows(
    matrix: list[HealthMatrixRow], report_status: dict[UUID, str]
) -> list[MyProjectHealthRow]:
    return [
        MyProjectHealthRow(**row.model_dump(), report_status=report_status.get(row.entity_id, "Not Submitted"))
        for row in matrix
    ]


# Account RAG card for the Project Health dashboard — the account-level
# sibling of the "Project Health" (green/amber/red/reporting-overdue) card.
# RAG counts come off the same latest-AccountHealthDeclaration overall_rating
# the account_health_matrix / health_split pair already computes; the overdue
# count mirrors _reports_due_rows but against AccountStatusReport (Submitted/
# Approved == filed) across every active reporting period.
async def account_rag_card_summary(db: AsyncSession, filters: DashboardFilters) -> AccountRagCardSummary:
    matrix = await account_health_matrix(db, filters)
    green, amber, potential_red, red = health_split(matrix)

    accounts = await account_health_rows(db, filters)
    periods = await _active_reporting_periods(db)
    overdue = 0
    if accounts and periods:
        account_ids = [a.account_id for a in accounts]
        period_ids = [p.id for p in periods]
        reports = (
            await db.execute(
                select(AccountStatusReport).where(
                    AccountStatusReport.account_id.in_(account_ids),
                    AccountStatusReport.period_id.in_(period_ids),
                )
            )
        ).scalars().all()
        filed = {(r.account_id, r.period_id) for r in reports if r.status in ("Submitted", "Approved")}
        today = date.today()
        for account in accounts:
            for period in periods:
                if (account.account_id, period.id) not in filed and period.end_date < today:
                    overdue += 1

    return AccountRagCardSummary(
        green_count=green,
        amber_count=amber,
        potential_red_count=potential_red,
        red_count=red,
        reporting_overdue_count=overdue,
    )


# Account Head "My Summary" (design-reference/acchead-mysummary.jpg) — every
# helper below is called with filters.account_ids set to the signed-in
# Account Manager's owned accounts (see dashboard.py's
# get_account_head_dashboard_summary); project_health_rows(db, filters)
# already returns exactly the projects under those accounts.

_ACCOUNT_STATUS_LABELS: dict[HealthRating, str] = {
    HealthRating.GREEN: "On Track",
    HealthRating.AMBER: "At Risk",
    HealthRating.RED: "Critical",
    HealthRating.POTENTIAL_RED: "Critical",
}


# Submitted-but-not-yet-reviewed reports across every in-scope project — the
# work items the Report Review Queue table exists to surface. Returns (top
# `limit` rows oldest-submitted-first, i.e. most overdue for review, total
# count) so the AWAITING REVIEW stat card can show the true total even when
# the table itself is capped.
async def report_review_queue(
    db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow], limit: int = 10
) -> tuple[list[ReportReviewQueueRow], int]:
    if not projects:
        return [], 0
    project_ids = [p.project_id for p in projects]
    labels = {p.project_id: f"{p.project_code} · {p.project_name}" for p in projects}
    healths = {p.project_id: p.overall_project_health for p in projects}

    stmt = (
        select(ProjectStatusReport, ReportingPeriod.label, User.full_name)
        .join(ReportingPeriod, ReportingPeriod.id == ProjectStatusReport.period_id)
        .join(Project, Project.id == ProjectStatusReport.project_id)
        .outerjoin(User, User.id == Project.project_manager_id)
        .where(ProjectStatusReport.project_id.in_(project_ids), ProjectStatusReport.status == ReportStatus.SUBMITTED)
        .order_by(ProjectStatusReport.updated_at)
    )
    rows = (await db.execute(stmt)).all()

    all_rows = [
        ReportReviewQueueRow(
            report_id=report.id,
            project_id=report.project_id,
            project_label=labels.get(report.project_id, "Unknown project"),
            project_manager_name=pm_name,
            period_label=period_label,
            health=healths.get(report.project_id),
            # No dedicated submitted_at column on ProjectStatusReport —
            # updated_at is the best available proxy, since the Draft ->
            # Submitted transition happens via the report's update endpoint.
            submitted_at=report.updated_at,
            href=f"/project-review/{report.project_id}",
        )
        for report, period_label, pm_name in rows
    ]
    return all_rows[:limit], len(all_rows)


# Per-account project counts + health split, keyed off the same
# project_health_matrix/account_health_matrix rows the endpoint already
# fetches for the Health Split tile — status_label comes from the account's
# own latest AccountHealthDeclaration rating (account_matrix), independent of
# how its projects individually roll up.
def account_portfolio_health(
    project_matrix: list[HealthMatrixRow], account_matrix: list[HealthMatrixRow]
) -> list[AccountPortfolioHealthRow]:
    by_account: dict[UUID, list[HealthRating]] = defaultdict(list)
    active_counts: dict[UUID, int] = defaultdict(int)
    for row in project_matrix:
        if row.account_id is None:
            continue
        active_counts[row.account_id] += 1
        if row.overall_rating is not None:
            by_account[row.account_id].append(row.overall_rating)

    rows = []
    for account in account_matrix:
        ratings = by_account.get(account.entity_id, [])
        rows.append(
            AccountPortfolioHealthRow(
                account_id=account.entity_id,
                account_name=account.entity_label,
                active_projects_count=active_counts.get(account.entity_id, 0),
                health_green=sum(1 for r in ratings if r == HealthRating.GREEN),
                health_amber=sum(1 for r in ratings if r == HealthRating.AMBER),
                health_potential_red=sum(1 for r in ratings if r == HealthRating.POTENTIAL_RED),
                health_red=sum(1 for r in ratings if r == HealthRating.RED),
                status_label=_ACCOUNT_STATUS_LABELS.get(account.overall_rating, "Not Rated"),
            )
        )
    return rows


# Reporting Readiness card — like project_report_status, reduced to the
# nearest (soonest-ending) active reporting period, but here every
# ReportStatus value gets its own bucket (Approved/Submitted/Rejected/absent)
# instead of collapsing to a single display label.
async def reporting_readiness(
    db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow]
) -> ReportingReadiness:
    total = len(projects)
    if not projects:
        return ReportingReadiness(
            ready_count=0, total_count=0, approved_count=0, awaiting_review_count=0, not_submitted_count=0, rejected_count=0
        )
    periods = await _active_reporting_periods(db)
    if not periods:
        return ReportingReadiness(
            ready_count=0,
            total_count=total,
            approved_count=0,
            awaiting_review_count=0,
            not_submitted_count=total,
            rejected_count=0,
        )
    nearest_period = min(periods, key=lambda p: p.end_date)
    project_ids = [p.project_id for p in projects]

    reports = (
        await db.execute(
            select(ProjectStatusReport).where(
                ProjectStatusReport.project_id.in_(project_ids),
                ProjectStatusReport.period_id == nearest_period.id,
            )
        )
    ).scalars().all()
    by_project = {r.project_id: r for r in reports}

    approved = awaiting = rejected = not_submitted = 0
    for project in projects:
        report = by_project.get(project.project_id)
        if report is None or report.status == ReportStatus.DRAFT:
            not_submitted += 1
        elif report.status == ReportStatus.APPROVED:
            approved += 1
        elif report.status == ReportStatus.SUBMITTED:
            awaiting += 1
        elif report.status == ReportStatus.REJECTED:
            rejected += 1

    return ReportingReadiness(
        ready_count=approved,
        total_count=total,
        approved_count=approved,
        awaiting_review_count=awaiting,
        not_submitted_count=not_submitted,
        rejected_count=rejected,
    )


# "Attention Required" banner (Account Head variant) — reports that have sat
# in the review queue at least a day, plus any account whose own health
# declaration has gone Critical. Deliberately separate from the generic
# attention_required above: that one flags *unsubmitted* reports (a PM
# problem); this flags *unreviewed* ones (an Account Head problem).
def account_head_attention_required(
    queue: list[ReportReviewQueueRow], portfolio: list[AccountPortfolioHealthRow], limit: int = 5
) -> list[AttentionItem]:
    items: list[AttentionItem] = []
    now = datetime.now(timezone.utc)

    for row in queue:
        days = (now - row.submitted_at).days
        if days < 1:
            continue
        items.append(
            AttentionItem(
                title=f"{row.project_label}: Report awaiting review for {days} day{'s' if days != 1 else ''}",
                subtitle=f"Submitted {row.submitted_at.strftime('%b %d')}",
                href=row.href,
            )
        )

    for account in portfolio:
        if account.status_label == "Critical":
            items.append(
                AttentionItem(
                    title=f"{account.account_name}: Account Health is RED",
                    subtitle=f"{account.health_red} project{'s' if account.health_red != 1 else ''} red",
                    href=f"/account-review/{account.account_id}",
                )
            )

    return items[:limit]


# Cross-account "My Actions" — like my_open_actions above but fans out across
# both PROJECT-level actions (in-scope projects) and ACCOUNT-level actions
# (owned accounts directly), since an Account Head can be assigned either.
async def account_head_open_actions(
    db: AsyncSession, filters: DashboardFilters, projects: list[ProjectHealthRow], current_user_id: UUID
) -> list[AccountHeadOpenActionRow]:
    account_ids = filters.account_ids or []
    project_labels = {p.project_id: f"{p.project_code} · {p.project_name}" for p in projects}
    if not account_ids and not project_labels:
        return []

    account_labels: dict[UUID, str] = {}
    if account_ids:
        account_rows = (await db.execute(select(Account.id, Account.name).where(Account.id.in_(account_ids)))).all()
        account_labels = dict(account_rows)

    level_values = [str(pid) for pid in project_labels] + [str(aid) for aid in account_ids]
    if not level_values:
        return []

    stmt = (
        select(Action)
        .where(
            Action.level.in_([ActionLevel.PROJECT, ActionLevel.ACCOUNT]),
            Action.level_value.in_(level_values),
            Action.action_by_id == current_user_id,
            Action.status.in_([ActionStatus.OPEN, ActionStatus.IN_PROGRESS]),
        )
        .order_by(Action.due_date)
    )
    actions = (await db.execute(stmt)).scalars().all()

    today = date.today()
    week_out = today + timedelta(days=7)
    rows = []
    for a in actions:
        entity_id = UUID(a.level_value)
        if a.level == ActionLevel.ACCOUNT:
            label = account_labels.get(entity_id, "Unknown account")
            href = f"/account-review/{entity_id}"
        else:
            label = project_labels.get(entity_id, "Unknown project")
            href = f"/project-review/{entity_id}"
        rows.append(
            AccountHeadOpenActionRow(
                id=a.id,
                title=a.title,
                entity_label=label,
                due_date=a.due_date,
                overdue=a.due_date < today,
                due_this_week=today <= a.due_date <= week_out,
                href=href,
                priority=a.priority,
            )
        )
    return rows


# Geo Head "My Summary" (design-reference/geohead-mysummary.jpg) — the Geo
# Head role's counterpart to the Account Head helpers above, one tier up:
# reviews Submitted AccountStatusReports (not ProjectStatusReports) and owns
# geo(s) rather than accounts directly.


# Account-level equivalent of report_review_queue's project-level queue —
# Submitted AccountStatusReports awaiting this Geo Head's review. `health`
# comes from the already-fetched account_matrix (same source
# account_portfolio_health uses), not a new query.
async def account_review_queue(
    db: AsyncSession, account_ids: list[UUID], account_matrix: list[HealthMatrixRow], limit: int = 10
) -> tuple[list[AccountReviewQueueRow], int]:
    if not account_ids:
        return [], 0
    healths = {row.entity_id: row.overall_rating for row in account_matrix}

    stmt = (
        select(AccountStatusReport, Account.name, User.full_name)
        .join(Account, Account.id == AccountStatusReport.account_id)
        .outerjoin(UserAccount, UserAccount.account_id == Account.id)
        .outerjoin(User, User.id == UserAccount.user_id)
        .where(AccountStatusReport.account_id.in_(account_ids), AccountStatusReport.status == ReportStatus.SUBMITTED)
        .order_by(AccountStatusReport.updated_at)
    )
    rows = (await db.execute(stmt)).all()

    all_rows = [
        AccountReviewQueueRow(
            account_id=report.account_id,
            account_name=account_name,
            account_head_name=head_name,
            health=healths.get(report.account_id),
            # No dedicated submitted_at column on AccountStatusReport —
            # updated_at is the best available proxy, same convention as
            # report_review_queue's ProjectStatusReport handling.
            submitted_at=report.updated_at,
            href=f"/account-review/{report.account_id}",
        )
        for report, account_name, head_name in rows
    ]
    return all_rows[:limit], len(all_rows)


# Worst-of the latest GeoHealthDeclaration.overall_rating across the given
# geo(s) — geo-level equivalent of AccountPortfolioHealthRow.status_label,
# reduced to a single KPI badge instead of a per-account list.
async def geo_health_rating(db: AsyncSession, geo_ids: list[UUID]) -> HealthRating | None:
    if not geo_ids:
        return None
    declarations = (
        await db.execute(select(GeoHealthDeclaration).where(GeoHealthDeclaration.geo_id.in_(geo_ids)))
    ).scalars().all()
    latest: dict[UUID, GeoHealthDeclaration] = {}
    for decl in declarations:
        current = latest.get(decl.geo_id)
        if current is None or decl.created_at > current.created_at:
            latest[decl.geo_id] = decl
    ratings = [HealthRating(decl.overall_rating) for decl in latest.values()]
    if not ratings:
        return None
    rank = {HealthRating.RED: 0, HealthRating.POTENTIAL_RED: 1, HealthRating.AMBER: 2, HealthRating.GREEN: 3}
    return min(ratings, key=lambda r: rank[r])


# True if any of the given geo(s) lacks a Submitted GeoStatusReport for the
# nearest active reporting period — geo-level equivalent of
# _reports_due_rows, reduced to a single "GEO REPORT DUE" badge instead of
# per-project rows, since a Geo Head submits one rollup report per geo.
async def geo_report_due(db: AsyncSession, geo_ids: list[UUID]) -> bool:
    if not geo_ids:
        return False
    periods = await _active_reporting_periods(db)
    if not periods:
        return False
    nearest_period = min(periods, key=lambda p: p.end_date)
    submitted_geo_ids = set(
        (
            await db.execute(
                select(GeoStatusReport.geo_id).where(
                    GeoStatusReport.geo_id.in_(geo_ids),
                    GeoStatusReport.period_id == nearest_period.id,
                    GeoStatusReport.status == ReportStatus.SUBMITTED,
                )
            )
        )
        .scalars()
        .all()
    )
    return any(geo_id not in submitted_geo_ids for geo_id in geo_ids)


# Cross-geo "My Actions" — like account_head_open_actions but spans a third
# ActionLevel (GEO), since a Geo Head can be assigned actions at any of the
# three levels under them.
async def geo_head_open_actions(
    db: AsyncSession,
    projects: list[ProjectHealthRow],
    account_ids: list[UUID],
    geo_ids: list[UUID],
    current_user_id: UUID,
) -> list[AccountHeadOpenActionRow]:
    project_labels = {p.project_id: f"{p.project_code} · {p.project_name}" for p in projects}
    if not project_labels and not account_ids and not geo_ids:
        return []

    account_labels: dict[UUID, str] = {}
    if account_ids:
        account_rows = (await db.execute(select(Account.id, Account.name).where(Account.id.in_(account_ids)))).all()
        account_labels = dict(account_rows)

    geo_labels: dict[UUID, str] = {}
    if geo_ids:
        geo_rows = (await db.execute(select(Geo.id, Geo.name).where(Geo.id.in_(geo_ids)))).all()
        geo_labels = dict(geo_rows)

    level_values = (
        [str(pid) for pid in project_labels] + [str(aid) for aid in account_ids] + [str(gid) for gid in geo_ids]
    )
    if not level_values:
        return []

    stmt = (
        select(Action)
        .where(
            Action.level.in_([ActionLevel.PROJECT, ActionLevel.ACCOUNT, ActionLevel.GEO]),
            Action.level_value.in_(level_values),
            Action.action_by_id == current_user_id,
            Action.status.in_([ActionStatus.OPEN, ActionStatus.IN_PROGRESS]),
        )
        .order_by(Action.due_date)
    )
    actions = (await db.execute(stmt)).scalars().all()

    today = date.today()
    week_out = today + timedelta(days=7)
    rows = []
    for a in actions:
        entity_id = UUID(a.level_value)
        if a.level == ActionLevel.GEO:
            label = geo_labels.get(entity_id, "Unknown geo")
            href = f"/geo-reporting/{entity_id}"
        elif a.level == ActionLevel.ACCOUNT:
            label = account_labels.get(entity_id, "Unknown account")
            href = f"/account-review/{entity_id}"
        else:
            label = project_labels.get(entity_id, "Unknown project")
            href = f"/project-review/{entity_id}"
        rows.append(
            AccountHeadOpenActionRow(
                id=a.id,
                title=a.title,
                entity_label=label,
                due_date=a.due_date,
                overdue=a.due_date < today,
                due_this_week=today <= a.due_date <= week_out,
                href=href,
                priority=a.priority,
            )
        )
    return rows


# Categorized "Critical Attention" box (design-reference/geohead-mysummary.jpg)
# — one representative item per non-empty bucket (Red Account / Critical
# Risks / Overdue Reviews), unlike account_head_attention_required's flat
# list, since the mockup groups items under bold category headings.
def geo_critical_attention(
    queue: list[AccountReviewQueueRow],
    portfolio: list[AccountPortfolioHealthRow],
    high_critical_risks_count: int,
) -> list[GeoAttentionItem]:
    items: list[GeoAttentionItem] = []

    red_accounts = [a for a in portfolio if a.status_label == "Critical"]
    if red_accounts:
        first = red_accounts[0]
        items.append(
            GeoAttentionItem(
                category="Red Account" if len(red_accounts) == 1 else f"{len(red_accounts)} Red Accounts",
                title=first.account_name,
                subtitle=f"{first.account_name} requires immediate intervention.",
                href=f"/account-review/{first.account_id}",
            )
        )

    if high_critical_risks_count > 0:
        items.append(
            GeoAttentionItem(
                category=f"{high_critical_risks_count} Critical Risk{'s' if high_critical_risks_count != 1 else ''}",
                title="High/Critical risks open",
                subtitle=f"{high_critical_risks_count} open risk(s) rated High or Critical across your accounts.",
                href=f"/account-review/{portfolio[0].account_id}" if portfolio else "",
            )
        )

    now = datetime.now(timezone.utc)
    overdue = sorted(
        (row for row in queue if (now - row.submitted_at).days >= 1),
        key=lambda row: row.submitted_at,
    )
    if overdue:
        oldest = overdue[0]
        days = (now - oldest.submitted_at).days
        items.append(
            GeoAttentionItem(
                category="Overdue Review" if len(overdue) == 1 else f"{len(overdue)} Overdue Reviews",
                title=oldest.account_name,
                subtitle=f"{oldest.account_name} report is {days} day{'s' if days != 1 else ''} overdue.",
                href=oldest.href,
            )
        )

    return items


_EXEC_UPDATE_STATUS_DESCRIPTIONS = {
    ReportStatus.DRAFT: "Draft executive update in progress.",
    ReportStatus.SUBMITTED: "Executive update submitted, awaiting review.",
    ReportStatus.APPROVED: "Executive update approved.",
    ReportStatus.REJECTED: "Executive update rejected — needs revision.",
}


# Latest ExecutiveUpdate across the given geo(s) for the "Executive Update"
# card — the feature itself (executive_updates.py) is fully built already,
# this just reduces it to a one-line status for the summary page.
async def geo_executive_update_summary(db: AsyncSession, geo_ids: list[UUID]) -> GeoExecutiveUpdateSummary | None:
    if not geo_ids:
        return None
    update = (
        await db.execute(
            select(ExecutiveUpdate)
            .where(ExecutiveUpdate.geo_id.in_(geo_ids))
            .order_by(ExecutiveUpdate.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if update is None:
        return GeoExecutiveUpdateSummary(
            status="Not Started",
            description="No executive update started yet for the current period.",
            href=f"/geo-reporting/{geo_ids[0]}/executive-update",
        )
    status = ReportStatus(update.status)
    return GeoExecutiveUpdateSummary(
        status=status.value,
        description=_EXEC_UPDATE_STATUS_DESCRIPTIONS.get(status, "Executive update in progress."),
        href=f"/geo-reporting/{update.geo_id}/executive-update",
    )


# Delivery Excellence "My Summary" (design-reference/de-mysummary.jpg) —
# scoped to projects where the signed-in user is Project.delivery_excellence_id
# (same one-value-FK idiom as project_manager_id, not an owned list like
# accounts/geos). A DE assessment is independent of weekly/monthly reporting
# periods: the queue/dashboard work off the current *calendar month*
# (current_month_window) and treat assessment_date as the thing to bracket
# against it. Every helper below takes such a window, duck-typed to a
# ReportingPeriod's .start_date / .end_date / .label.
class MonthWindow(NamedTuple):
    start_date: date
    end_date: date
    label: str


# The current calendar month — the DE Assessment cadence ("at least once per
# month") is measured against this, not a reporting_periods row.
def current_month_window(today: date | None = None) -> MonthWindow:
    d = today or date.today()
    start = d.replace(day=1)
    end = d.replace(day=monthrange(d.year, d.month)[1])
    return MonthWindow(start_date=start, end_date=end, label=start.strftime("%B %Y"))


# One row per in-scope project. "status" reflects this calendar month:
# "Assessed" (>=1 Submitted assessment this month), "Draft" (only a Draft this
# month) or "Due" (nothing this month). A project may be assessed any number of
# times per month; de_health / pci_score / assessed_by_name come from the most
# recent assessment this month, prev_* from the latest Submitted one before it.
_FINDING_OPEN_STATES = (
    FindingStatus.OPEN,
    FindingStatus.IN_PROGRESS,
    FindingStatus.AWAITING_CLOSURE,
    FindingStatus.ON_HOLD,
    FindingStatus.DEFERRED,
)


async def de_assessment_work_queue(
    db: AsyncSession, filters: DashboardFilters, period: MonthWindow
) -> list[DEAssessmentWorkQueueRow]:
    conditions = _project_conditions(filters)
    stmt = select(Project, User.full_name, Account.name, Geo.name, Region.name).outerjoin(
        User, User.id == Project.project_manager_id
    ).outerjoin(Account, Account.id == Project.account_id).outerjoin(
        Geo, Geo.id == Project.geo_id
    ).outerjoin(Region, Region.id == Project.region_id)
    if conditions:
        stmt = stmt.where(*conditions)
    rows = (await db.execute(stmt)).all()
    if not rows:
        return []
    project_ids = [project.id for project, *_ in rows]

    all_assessments = (
        await db.execute(select(DEAssessment).where(DEAssessment.project_id.in_(project_ids)))
    ).scalars().all()

    # Per project: assessments this month, the count, and the latest Submitted
    # one dated before this month (prev_*).
    month_by_project: dict[UUID, list[DEAssessment]] = defaultdict(list)
    last_by_project: dict[UUID, DEAssessment] = {}
    prev_by_project: dict[UUID, DEAssessment] = {}
    for a in all_assessments:
        if a.assessment_date is None:
            continue
        current_last = last_by_project.get(a.project_id)
        if current_last is None or a.assessment_date > current_last.assessment_date:
            last_by_project[a.project_id] = a
        if period.start_date <= a.assessment_date <= period.end_date:
            month_by_project[a.project_id].append(a)
        elif a.assessment_date < period.start_date and a.status == "Submitted":
            current_prev = prev_by_project.get(a.project_id)
            if current_prev is None or a.assessment_date > current_prev.assessment_date:
                prev_by_project[a.project_id] = a

    assessor_ids = {a.assessed_by for a in all_assessments if a.assessed_by is not None}
    assessor_names: dict[UUID, str] = {}
    if assessor_ids:
        assessor_names = dict(
            (await db.execute(select(User.id, User.full_name).where(User.id.in_(assessor_ids)))).all()
        )

    open_findings_count: dict[UUID, int] = defaultdict(int)
    finding_rows = (
        await db.execute(
            select(DEAssessmentFinding.project_id, func.count(DEAssessmentFinding.id))
            .where(
                DEAssessmentFinding.project_id.in_(project_ids),
                DEAssessmentFinding.status.in_([s.value for s in _FINDING_OPEN_STATES]),
            )
            .group_by(DEAssessmentFinding.project_id)
        )
    ).all()
    for project_id, count in finding_rows:
        open_findings_count[project_id] = count

    work_queue = []
    for project, pm_name, account_name, geo_name, region_name in rows:
        this_month = sorted(
            month_by_project.get(project.id, []), key=lambda a: a.assessment_date, reverse=True
        )
        latest = this_month[0] if this_month else None
        prev = prev_by_project.get(project.id)
        last_any = last_by_project.get(project.id)
        if any(a.status == "Submitted" for a in this_month):
            row_status = "Assessed"
        elif this_month:
            row_status = "Draft"
        else:
            row_status = "Due"
        work_queue.append(
            DEAssessmentWorkQueueRow(
                project_id=project.id,
                project_code=project.project_code,
                project_name=project.project_name,
                project_manager_name=pm_name,
                account_name=account_name,
                geo_name=geo_name,
                region_name=region_name,
                pm_health=project.delivery_declared_overall_health,
                de_health=latest.de_assessed_project_health if latest is not None else None,
                pci_score=latest.pci_score if latest is not None else None,
                status=row_status,
                assessments_this_month=len(this_month),
                last_assessment_date=last_any.assessment_date if last_any is not None else None,
                assessed_by_name=(
                    assessor_names.get(latest.assessed_by) if latest is not None else None
                ),
                open_findings_count=open_findings_count.get(project.id, 0),
                prev_de_health=prev.de_assessed_project_health if prev is not None else None,
                prev_pci_score=prev.pci_score if prev is not None else None,
                href=f"/de-assessment/{project.id}",
            )
        )
    return sorted(work_queue, key=lambda r: r.project_name)


# Every DEAssessmentFinding across in-scope projects, keyed by project_id —
# fetched once and shared by de_findings_summary and de_attention_required
# below (small portfolio, same "narrow query + Python reduction" style as the
# rest of this file).
async def de_findings_by_project(
    db: AsyncSession, filters: DashboardFilters
) -> dict[UUID, list[DEAssessmentFinding]]:
    project_ids = await _matching_project_ids(db, filters)
    stmt = select(DEAssessmentFinding).where(DEAssessmentFinding.project_id.in_(project_ids))
    rows = (await db.execute(stmt)).scalars().all()
    by_project: dict[UUID, list[DEAssessmentFinding]] = defaultdict(list)
    for finding in rows:
        by_project[finding.project_id].append(finding)
    return by_project


# Open findings across in-scope projects (My Summary "Open Findings" card).
# Same shape as count_open_risks/count_open_issues; scoping comes from
# _matching_project_ids, which already honors project_manager_id / account_ids /
# geo_ids, so this works for every role /dashboard/my-summary serves.
async def count_open_findings(db: AsyncSession, filters: DashboardFilters) -> int:
    project_ids = await _matching_project_ids(db, filters)
    stmt = (
        select(func.count())
        .select_from(DEAssessmentFinding)
        .where(
            DEAssessmentFinding.project_id.in_(project_ids),
            DEAssessmentFinding.status.in_([s.value for s in _FINDING_OPEN_STATES]),
        )
    )
    return (await db.execute(stmt)).scalar_one()


# Findings have no due-date field — any still-Open finding raised more than
# this many days ago is treated as overdue, an editorial threshold consistent
# with a monthly assessment cadence.
_FINDING_OVERDUE_DAYS = 30


def de_findings_summary(
    findings_by_project: dict[UUID, list[DEAssessmentFinding]], period: ReportingPeriod
) -> DEFindingsSummary:
    findings = [f for project_findings in findings_by_project.values() for f in project_findings]
    today = date.today()

    open_findings = [f for f in findings if f.status == FindingStatus.OPEN]
    overdue = [
        f for f in open_findings if f.finding_date is not None and (today - f.finding_date).days > _FINDING_OVERDUE_DAYS
    ]
    new_this_period = [
        f for f in findings if f.finding_date is not None and period.start_date <= f.finding_date <= period.end_date
    ]
    closed_this_period = [
        f
        for f in findings
        if f.status == FindingStatus.CLOSED and period.start_date <= f.updated_at.date() <= period.end_date
    ]

    # Grouped by the finding's classification (Observation / Recommendation / NC).
    by_classification: dict[str, int] = defaultdict(int)
    for f in open_findings:
        by_classification[f.classification] += 1

    return DEFindingsSummary(
        open_count=len(open_findings),
        overdue_count=len(overdue),
        new_this_period_count=len(new_this_period),
        closed_this_period_count=len(closed_this_period),
        by_classification=[
            FindingClassificationBreakdownRow(classification=c, count=n)
            for c, n in sorted(by_classification.items())
        ],
    )


# Up to the 2 most-recent DEAssessment rows per in-scope project, as of the
# selected period's end date — used to detect a still-overdue
# next_assessment_due_date and a declining PCI score, independent of whether
# an assessment was filed in this exact period.
async def de_recent_assessments(
    db: AsyncSession, filters: DashboardFilters, period: ReportingPeriod
) -> dict[UUID, list[DEAssessment]]:
    project_ids = await _matching_project_ids(db, filters)
    stmt = (
        select(DEAssessment)
        .where(DEAssessment.project_id.in_(project_ids), DEAssessment.assessment_date <= period.end_date)
        .order_by(DEAssessment.assessment_date.desc())
    )
    assessments = (await db.execute(stmt)).scalars().all()
    by_project: dict[UUID, list[DEAssessment]] = defaultdict(list)
    for a in assessments:
        if len(by_project[a.project_id]) < 2:
            by_project[a.project_id].append(a)
    return by_project


# "Attention Required" (design-reference/de-mysummary.jpg) — flat list, one
# item per triggered rule per project: overdue assessment, overdue findings,
# PM Health degraded with no DE assessment yet, and a declining PCI score.
def de_attention_required(
    work_queue: list[DEAssessmentWorkQueueRow],
    findings_by_project: dict[UUID, list[DEAssessmentFinding]],
    recent_assessments_by_project: dict[UUID, list[DEAssessment]],
    limit: int = 5,
) -> list[AttentionItem]:
    items: list[AttentionItem] = []
    today = date.today()

    for row in work_queue:
        recent = recent_assessments_by_project.get(row.project_id, [])
        latest = recent[0] if recent else None

        if (
            row.status == "Due"
            and latest is not None
            and latest.next_assessment_due_date is not None
            and latest.next_assessment_due_date < today
        ):
            days = (today - latest.next_assessment_due_date).days
            items.append(
                AttentionItem(
                    title=f"{row.project_name}: DE Assessment overdue by {days} day{'s' if days != 1 else ''}",
                    subtitle=f"Next assessment was due {latest.next_assessment_due_date.strftime('%b %d')}",
                    href=row.href,
                )
            )

        overdue_findings = sum(
            1
            for f in findings_by_project.get(row.project_id, [])
            if f.status == FindingStatus.OPEN
            and f.finding_date is not None
            and (today - f.finding_date).days > _FINDING_OVERDUE_DAYS
        )
        if overdue_findings > 0:
            items.append(
                AttentionItem(
                    title=f"{row.project_name}: {overdue_findings} overdue finding{'s' if overdue_findings != 1 else ''}",
                    subtitle="Open findings past the 30-day review window",
                    href=row.href,
                )
            )

        if (
            row.pm_health in (HealthRating.AMBER, HealthRating.RED, HealthRating.POTENTIAL_RED)
            and row.de_health is None
        ):
            items.append(
                AttentionItem(
                    title=f"{row.project_name}: PM Health {row.pm_health} — DE Assessment pending",
                    subtitle="No DE assessment recorded this month yet",
                    href=row.href,
                )
            )

        if len(recent) == 2 and recent[0].pci_score is not None and recent[1].pci_score is not None:
            if recent[0].pci_score < recent[1].pci_score:
                prev_label = recent[1].assessment_date.strftime("%b %d") if recent[1].assessment_date else "an earlier date"
                items.append(
                    AttentionItem(
                        title=f"{row.project_name}: PCI declined from {recent[1].pci_score} to {recent[0].pci_score}",
                        subtitle=f"Previous assessment {prev_label}",
                        href=row.href,
                    )
                )

    return items[:limit]


# PMO "My Summary" (design-reference/pmo-mysummary.jpg) — the PMO role's
# portfolio-wide counterpart to the role-scoped summaries above: every helper
# below is called with an empty DashboardFilters() (org-wide, no PMO login
# exists yet to scope by), unlike every prior section's owned
# geo/account/project_manager_id scoping.


async def _latest_de_assessment_by_project(db: AsyncSession, project_ids: list[UUID]) -> dict[UUID, DEAssessment]:
    if not project_ids:
        return {}
    assessments = (
        await db.execute(select(DEAssessment).where(DEAssessment.project_id.in_(project_ids)))
    ).scalars().all()
    latest: dict[UUID, DEAssessment] = {}
    for a in assessments:
        current = latest.get(a.project_id)
        if current is None or (a.assessment_date or date.min) > (current.assessment_date or date.min):
            latest[a.project_id] = a
    return latest


# Distinct in-scope projects whose latest DEAssessment.next_assessment_due_date
# has passed — the "Assessments Overdue" stat card, org-wide equivalent of
# de_attention_required's per-project overdue-assessment rule.
async def count_assessments_overdue(db: AsyncSession, project_ids: list[UUID]) -> int:
    latest = await _latest_de_assessment_by_project(db, project_ids)
    today = date.today()
    return sum(
        1 for a in latest.values() if a.next_assessment_due_date is not None and a.next_assessment_due_date < today
    )


# Every incomplete Action overdue as of today, across every level (Geo/
# Account/Project) — org-wide, unlike my_open_actions'/account_head_open_actions'
# per-owner scoping, since the PMO summary reports totals, not "my" actions.
async def count_overdue_actions(db: AsyncSession) -> int:
    stmt = select(func.count()).select_from(Action).where(
        Action.status.not_in([ActionStatus.COMPLETED, ActionStatus.CLOSED, ActionStatus.CANCELLED]),
        Action.due_date < date.today(),
    )
    return (await db.execute(stmt)).scalar_one()


# Per in-scope project -> ("On Time"|"Late"|"Missing"|"Rework", the date that
# bucket is measured from) against the nearest active reporting period — same
# nearest-period convention as project_report_status/reporting_readiness, but
# split into the 4 buckets the Reporting Compliance donut needs instead of a
# single display label. Every project lands in exactly one bucket (unlike
# _reports_due_rows' "due" set), so bucket counts always sum to project count.
async def _project_reporting_bucket(
    db: AsyncSession, projects: list[ProjectHealthRow]
) -> dict[UUID, tuple[str, date]]:
    if not projects:
        return {}
    today = date.today()
    periods = await _active_reporting_periods(db)
    if not periods:
        return {p.project_id: ("Missing", today) for p in projects}
    nearest_period = min(periods, key=lambda p: p.end_date)
    project_ids = [p.project_id for p in projects]

    reports = (
        await db.execute(
            select(ProjectStatusReport).where(
                ProjectStatusReport.project_id.in_(project_ids),
                ProjectStatusReport.period_id == nearest_period.id,
            )
        )
    ).scalars().all()
    by_project = {r.project_id: r for r in reports}

    result: dict[UUID, tuple[str, date]] = {}
    for project in projects:
        report = by_project.get(project.project_id)
        if report is not None and report.status == ReportStatus.REJECTED:
            result[project.project_id] = ("Rework", report.updated_at.date())
        elif report is not None and report.status in (ReportStatus.SUBMITTED, ReportStatus.APPROVED):
            on_time = report.updated_at.date() <= nearest_period.end_date
            result[project.project_id] = ("On Time" if on_time else "Late", nearest_period.end_date)
        elif nearest_period.end_date < today:
            result[project.project_id] = ("Missing", nearest_period.end_date)
        else:
            result[project.project_id] = ("On Time", nearest_period.end_date)
    return result


def pmo_reporting_compliance_summary(
    buckets: dict[UUID, tuple[str, date]]
) -> PmoReportingComplianceSummary:
    counts = {"On Time": 0, "Late": 0, "Missing": 0, "Rework": 0}
    for label, _ in buckets.values():
        counts[label] += 1
    return PmoReportingComplianceSummary(
        on_time_count=counts["On Time"],
        late_count=counts["Late"],
        missing_count=counts["Missing"],
        rework_count=counts["Rework"],
    )


# Distinct in-scope projects with at least one measurement row recorded for
# the nearest active reporting period, across every measurement type (a
# project only ever fills in the one matching its project_type, so presence
# in ANY of these tables is enough to call the project's measurement
# submission current). MeasurementCloudMigration has no period_id of its own
# (see models/measurement.py), so it's matched by as_of_date falling inside
# the period instead.
async def _projects_with_measurement_for_period(
    db: AsyncSession, project_ids: list[UUID], period: ReportingPeriod
) -> set[UUID]:
    if not project_ids:
        return set()
    covered: set[UUID] = set()
    for table in (
        MeasurementDevelopment,
        MeasurementSupport,
        MeasurementStaffing,
        MeasurementTesting,
        MeasurementCloudMaintenance,
    ):
        stmt = select(table.project_id).where(table.project_id.in_(project_ids), table.period_id == period.id)
        covered.update((await db.execute(stmt)).scalars().all())

    migration_stmt = select(MeasurementCloudMigration.project_id).where(
        MeasurementCloudMigration.project_id.in_(project_ids),
        MeasurementCloudMigration.as_of_date >= period.start_date,
        MeasurementCloudMigration.as_of_date <= period.end_date,
    )
    covered.update((await db.execute(migration_stmt)).scalars().all())
    return covered


# project_id -> "Compliant" | "Major Gap" off the latest recorded actual per
# ContractualCommitment (same latest-actual reduction contractual_compliance_summary
# uses) — a project with no commitments at all has nothing to violate, so it's
# simply absent from the returned dict (callers default to "Compliant").
async def _project_contractual_status(db: AsyncSession, project_ids: list[UUID]) -> dict[UUID, str]:
    if not project_ids:
        return {}
    commitments = (
        await db.execute(
            select(ContractualCommitment.id, ContractualCommitment.project_id).where(
                ContractualCommitment.project_id.in_(project_ids)
            )
        )
    ).all()
    if not commitments:
        return {}
    commitment_to_project = dict(commitments)
    commitment_ids = list(commitment_to_project.keys())

    latest_actual_dates = (
        select(
            ContractualCommitmentActual.commitment_id,
            func.max(ContractualCommitmentActual.period_date).label("latest_date"),
        )
        .where(ContractualCommitmentActual.commitment_id.in_(commitment_ids))
        .group_by(ContractualCommitmentActual.commitment_id)
        .subquery()
    )
    latest_status_stmt = select(
        ContractualCommitmentActual.commitment_id, ContractualCommitmentActual.met_status
    ).join(
        latest_actual_dates,
        (ContractualCommitmentActual.commitment_id == latest_actual_dates.c.commitment_id)
        & (ContractualCommitmentActual.period_date == latest_actual_dates.c.latest_date),
    )
    rows = (await db.execute(latest_status_stmt)).all()

    not_met_projects = {
        commitment_to_project[commitment_id]
        for commitment_id, met_status in rows
        if met_status in ("Not Met", "Breached")
    }
    return {
        project_id: ("Major Gap" if project_id in not_met_projects else "Compliant")
        for project_id in set(commitment_to_project.values())
    }


# project_id -> earliest (most overdue) next_review_date among its still-open
# Risk/Issue/Dependency/Opportunity items — "Stale RAIDO" reuses the
# next_review_date field these logs already carry to schedule their own
# review, rather than inventing a new staleness threshold.
async def _projects_with_stale_raido(db: AsyncSession, project_ids: list[UUID]) -> dict[UUID, date]:
    if not project_ids:
        return {}
    today = date.today()
    stale: dict[UUID, date] = {}

    def _track(project_id: UUID, review_date: date | None) -> None:
        if review_date is None:
            return
        current = stale.get(project_id)
        if current is None or review_date < current:
            stale[project_id] = review_date

    risk_rows = (
        await db.execute(
            select(RiskLog.project_id, RiskLog.next_review_date).where(
                RiskLog.project_id.in_(project_ids),
                RiskLog.current_status != RiskStatus.CLOSED,
                RiskLog.next_review_date < today,
            )
        )
    ).all()
    for project_id, review_date in risk_rows:
        _track(project_id, review_date)

    issue_rows = (
        await db.execute(
            select(IssueLog.project_id, IssueLog.next_review_date).where(
                IssueLog.project_id.in_(project_ids),
                IssueLog.status.not_in([IssueStatus.RESOLVED, IssueStatus.CLOSED]),
                IssueLog.next_review_date < today,
            )
        )
    ).all()
    for project_id, review_date in issue_rows:
        _track(project_id, review_date)

    dependency_rows = (
        await db.execute(
            select(DependencyLog.project_id, DependencyLog.next_review_date).where(
                DependencyLog.project_id.in_(project_ids),
                DependencyLog.dependency_status != DependencyStatus.COMPLETED,
                DependencyLog.next_review_date < today,
            )
        )
    ).all()
    for project_id, review_date in dependency_rows:
        _track(project_id, review_date)

    opportunity_rows = (
        await db.execute(
            select(OpportunityLog.project_id, OpportunityLog.next_review_date).where(
                OpportunityLog.project_id.in_(project_ids),
                OpportunityLog.status.not_in([OpportunityStatus.IMPLEMENTED, OpportunityStatus.CLOSED]),
                OpportunityLog.next_review_date < today,
            )
        )
    ).all()
    for project_id, review_date in opportunity_rows:
        _track(project_id, review_date)

    return stale


_GOVERNANCE_SEVERITY = {"Major Gap": 0, "Minor Gap": 1, "Compliant": 2}


def _worst_governance_status(statuses: list[str]) -> str:
    return min(statuses, key=lambda s: _GOVERNANCE_SEVERITY[s])


# The Governance Compliance grid (design-reference/pmo-mysummary.jpg) — one
# row per org-wide project across 5 categories (Reporting/Measurement/
# Contractual/RAIDO/Assessment), each reduced to Compliant/Minor Gap/Major Gap,
# plus an Overall Status that's the worst of the 5 ("worst wins", same idiom
# health_rollup uses for health ratings). Returns the reporting buckets
# alongside the rows so the Reporting Compliance donut can reuse them instead
# of re-querying.
async def pmo_governance_compliance_matrix(
    db: AsyncSession, filters: DashboardFilters
) -> tuple[list[GovernanceComplianceRow], dict[UUID, tuple[str, date]], dict[UUID, date]]:
    projects = await project_health_rows(db, filters)
    if not projects:
        return [], {}, {}
    project_ids = [p.project_id for p in projects]

    reporting_buckets = await _project_reporting_bucket(db, projects)
    periods = await _active_reporting_periods(db)
    measurement_covered = (
        await _projects_with_measurement_for_period(db, project_ids, min(periods, key=lambda p: p.end_date))
        if periods
        else set()
    )
    contractual_status = await _project_contractual_status(db, project_ids)
    raido_stale = await _projects_with_stale_raido(db, project_ids)
    assessment_by_project = await _latest_de_assessment_by_project(db, project_ids)

    today = date.today()
    rows: list[GovernanceComplianceRow] = []
    for project in projects:
        reporting_label, _ = reporting_buckets.get(project.project_id, ("On Time", today))
        reporting_status = "Major Gap" if reporting_label == "Missing" else (
            "Minor Gap" if reporting_label == "Rework" else "Compliant"
        )
        measurement_status = "Compliant" if project.project_id in measurement_covered else "Minor Gap"
        this_contractual_status = contractual_status.get(project.project_id, "Compliant")
        raido_status = "Minor Gap" if project.project_id in raido_stale else "Compliant"

        assessment = assessment_by_project.get(project.project_id)
        if assessment is None:
            assessment_status = "Minor Gap"
        elif assessment.next_assessment_due_date is not None and assessment.next_assessment_due_date < today:
            assessment_status = "Major Gap"
        else:
            assessment_status = "Compliant"

        overall_status = _worst_governance_status(
            [reporting_status, measurement_status, this_contractual_status, raido_status, assessment_status]
        )

        rows.append(
            GovernanceComplianceRow(
                project_id=project.project_id,
                project_code=project.project_code,
                project_name=project.project_name,
                reporting_status=reporting_status,
                measurement_status=measurement_status,
                contractual_status=this_contractual_status,
                raido_status=raido_status,
                assessment_status=assessment_status,
                overall_status=overall_status,
                href=f"/project-reporting/{project.project_id}",
            )
        )

    return sorted(rows, key=lambda r: r.project_name), reporting_buckets, raido_stale


# Governance Exceptions table (design-reference/pmo-mysummary.jpg) — one row
# per non-compliant category per project, oldest/most-overdue first, capped
# like every other "queue" table in this module (report_review_queue,
# account_review_queue, ...).
async def pmo_governance_exceptions(
    db: AsyncSession,
    matrix: list[GovernanceComplianceRow],
    reporting_buckets: dict[UUID, tuple[str, date]],
    raido_stale: dict[UUID, date],
    limit: int = 10,
) -> list[GovernanceExceptionRow]:
    if not matrix:
        return []
    project_ids = [row.project_id for row in matrix]
    accounts = (
        await db.execute(
            select(Project.id, Account.name)
            .outerjoin(Account, Account.id == Project.account_id)
            .where(Project.id.in_(project_ids))
        )
    ).all()
    account_names = dict(accounts)

    today = date.today()
    overdue_actions_stmt = (
        select(Action.level_value, func.count())
        .where(
            Action.level == ActionLevel.PROJECT,
            Action.level_value.in_([str(pid) for pid in project_ids]),
            Action.status.not_in([ActionStatus.COMPLETED, ActionStatus.CLOSED, ActionStatus.CANCELLED]),
            Action.due_date < today,
        )
        .group_by(Action.level_value)
    )
    overdue_actions_by_project = {
        UUID(level_value): count for level_value, count in (await db.execute(overdue_actions_stmt)).all()
    }

    exceptions: list[GovernanceExceptionRow] = []
    for row in matrix:

        def _add(exception: str, trigger_date: date) -> None:
            exceptions.append(
                GovernanceExceptionRow(
                    project_id=row.project_id,
                    project_code=row.project_code,
                    project_name=row.project_name,
                    account_name=account_names.get(row.project_id),
                    exception=exception,
                    age_days=(today - trigger_date).days,
                    href=row.href,
                )
            )

        if row.reporting_status == "Major Gap":
            _, trigger_date = reporting_buckets.get(row.project_id, ("Missing", today))
            _add("Missing Reporting", trigger_date)

        overdue_count = overdue_actions_by_project.get(row.project_id, 0)
        if overdue_count > 0:
            _add(f"Overdue Actions ({overdue_count}+)" if overdue_count >= 5 else "Overdue Actions", today)

        if row.raido_status == "Minor Gap" and row.project_id in raido_stale:
            _add("Stale RAIDO", raido_stale[row.project_id])

        if row.measurement_status == "Minor Gap":
            _, trigger_date = reporting_buckets.get(row.project_id, ("Missing", today))
            _add("Missing Measurements", trigger_date)

        if row.contractual_status == "Major Gap":
            _add("Contractual Not Met", today)

        if row.assessment_status == "Major Gap":
            _add("DE Assessment Overdue", today)

    return sorted(exceptions, key=lambda e: e.age_days, reverse=True)[:limit]


# Project Health dashboard (design-reference/Project-Health.html) — an
# org-wide, portfolio-level bento-grid of KPI cards for PMO/Admin/CXO, built
# with the same DashboardFilters()/_project_conditions()/_matching_project_ids()
# pattern as every section above, but exposing the real Geo/Account/Project
# Type/Period filter bar this page has (unlike pmo_governance_compliance_matrix's
# unfiltered-only usage). Reuses existing helpers wherever the shape already
# matches (count_active_projects, count_high_critical_risks,
# count_open_risks/issues/dependencies, count_pending_approvals,
# count_assessments_overdue, count_overdue_actions, project_health_matrix,
# health_split, reports_due_summary); every function below is net-new.


async def project_portfolio_summary(db: AsyncSession, filters: DashboardFilters) -> ProjectPortfolioSummary:
    base_conditions = _project_conditions(filters)
    total_count = (await db.execute(select(func.count()).select_from(Project).where(*base_conditions))).scalar_one()
    active_count = await count_active_projects(db, filters)
    completed_count = (
        await db.execute(
            select(func.count())
            .select_from(Project)
            .where(*base_conditions, Project.lifecycle_status == ProjectLifecycleStatus.CLOSED.value)
        )
    ).scalar_one()
    on_hold_count = (
        await db.execute(
            select(func.count())
            .select_from(Project)
            .where(*base_conditions, Project.lifecycle_status == ProjectLifecycleStatus.HOLD.value)
        )
    ).scalar_one()
    return ProjectPortfolioSummary(
        total_count=total_count, active_count=active_count, completed_count=completed_count, on_hold_count=on_hold_count
    )


async def risk_card_summary(db: AsyncSession, filters: DashboardFilters) -> RiskCardSummary:
    project_ids = await _matching_project_ids(db, filters)
    today = date.today()
    open_condition = [RiskLog.project_id.in_(project_ids), RiskLog.current_status.in_(["Open", "Monitoring"])]

    open_count = (await db.execute(select(func.count()).select_from(RiskLog).where(*open_condition))).scalar_one()
    overdue_count = (
        await db.execute(
            select(func.count())
            .select_from(RiskLog)
            .where(*open_condition, RiskLog.target_resolution_date.is_not(None), RiskLog.target_resolution_date < today)
        )
    ).scalar_one()
    no_mitigation_count = (
        await db.execute(
            select(func.count())
            .select_from(RiskLog)
            .where(*open_condition, or_(RiskLog.mitigation_plan.is_(None), RiskLog.mitigation_plan == ""))
        )
    ).scalar_one()

    return RiskCardSummary(
        open_count=open_count,
        high_critical_count=await count_high_critical_risks(db, filters),
        overdue_count=overdue_count,
        no_mitigation_count=no_mitigation_count,
    )


# Issues have no built-in SLA field — any still-open issue raised more than
# this many days ago is treated as "aging", an editorial threshold consistent
# with _FINDING_OVERDUE_DAYS above.
_ISSUE_AGING_THRESHOLD_DAYS = 14


async def issue_card_summary(db: AsyncSession, filters: DashboardFilters) -> IssueCardSummary:
    project_ids = await _matching_project_ids(db, filters)
    today = date.today()
    open_condition = [IssueLog.project_id.in_(project_ids), IssueLog.status.not_in(["Resolved", "Closed"])]

    open_count = (await db.execute(select(func.count()).select_from(IssueLog).where(*open_condition))).scalar_one()
    critical_count = (
        await db.execute(
            select(func.count())
            .select_from(IssueLog)
            .where(*open_condition, IssueLog.severity == IssueSeverity.CRITICAL)
        )
    ).scalar_one()
    overdue_count = (
        await db.execute(
            select(func.count())
            .select_from(IssueLog)
            .where(*open_condition, IssueLog.due_date.is_not(None), IssueLog.due_date < today)
        )
    ).scalar_one()
    aging_over_threshold_count = (
        await db.execute(
            select(func.count())
            .select_from(IssueLog)
            .where(
                *open_condition,
                IssueLog.raised_date.is_not(None),
                IssueLog.raised_date < today - timedelta(days=_ISSUE_AGING_THRESHOLD_DAYS),
            )
        )
    ).scalar_one()

    return IssueCardSummary(
        open_count=open_count,
        critical_count=critical_count,
        overdue_count=overdue_count,
        aging_over_threshold_count=aging_over_threshold_count,
    )


# List rows for the Project Health drill-down screens (Project List, RAG,
# Risks, Issues). Unlike the *_card_summary functions above (counts only),
# these return the actual grid rows with joined display names, paginated.


async def list_projects_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[ProjectListRow], int]:
    conditions = _project_conditions(filters)
    if search:
        conditions.append(or_(Project.project_name.ilike(f"%{search}%"), Project.project_code.ilike(f"%{search}%")))

    total = (await db.execute(select(func.count()).select_from(Project).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(Project, ProjectType.name, Geo.name, Region.name, Account.name, User.full_name)
            .outerjoin(ProjectType, ProjectType.id == Project.project_type_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(User, User.id == Project.project_manager_id)
            .where(*conditions)
            .order_by(Project.project_code)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    items = [
        ProjectListRow(
            project_id=project.id,
            project_code=project.project_code,
            project_name=project.project_name,
            project_type_name=project_type_name,
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            project_manager_name=pm_name,
            start_date=project.planned_start_date,
            end_date=project.planned_end_date,
            overall_health=project.overall_project_health,
            status=project.lifecycle_status or project.project_status,
        )
        for project, project_type_name, geo_name, region_name, account_name, pm_name in rows
    ]
    return items, total


async def list_rag_rows(db: AsyncSession, filters: DashboardFilters, period_id: UUID | None = None) -> list[RagRow]:
    projects = await project_health_rows(db, filters)
    if not projects:
        return []
    project_ids = [p.project_id for p in projects]

    project_geo = (
        await db.execute(select(Project.id, Geo.name, Region.name).outerjoin(Geo, Geo.id == Project.geo_id).outerjoin(Region, Region.id == Project.region_id).where(Project.id.in_(project_ids)))
    ).all()
    geo_by_project = {pid: g for pid, g, _ in project_geo}
    region_by_project = {pid: r for pid, _, r in project_geo}

    decl_conditions = [HealthDeclaration.project_id.in_(project_ids)]
    if period_id is not None:
        decl_conditions.append(HealthDeclaration.period_id == period_id)
    declarations = (await db.execute(select(HealthDeclaration).where(*decl_conditions))).scalars().all()
    latest: dict[UUID, HealthDeclaration] = {}
    for decl in declarations:
        current = latest.get(decl.project_id)
        if current is None or decl.created_at > current.created_at:
            latest[decl.project_id] = decl

    period_ids = {decl.period_id for decl in latest.values()}
    period_labels: dict[UUID, str] = {}
    if period_ids:
        period_rows = (await db.execute(select(ReportingPeriod.id, ReportingPeriod.label).where(ReportingPeriod.id.in_(period_ids)))).all()
        period_labels = dict(period_rows)

    rows: list[RagRow] = []
    for p in projects:
        decl = latest.get(p.project_id)
        rows.append(
            RagRow(
                project_id=p.project_id,
                project_code=p.project_code,
                project_name=p.project_name,
                geo_name=geo_by_project.get(p.project_id),
                region_name=region_by_project.get(p.project_id),
                account_name=p.account_name,
                overall_rating=decl.overall_rating if decl else None,
                core_delivery_rating=decl.core_delivery_rating if decl else None,
                operational_rating=decl.operational_rating if decl else None,
                financial_rating=decl.financial_rating if decl else None,
                period_label=period_labels.get(decl.period_id) if decl else None,
                last_updated=decl.created_at if decl else None,
            )
        )
    return rows


# Account-level sibling of list_rag_rows — one row per in-scope account, its
# latest AccountHealthDeclaration broken out into all six category ratings.
# Backs the Project Health dashboard's "Account Health -> View Account RAG"
# drill-down. Paginated in Python by the endpoint, same as list_rag_rows.
async def list_account_rag_rows(
    db: AsyncSession, filters: DashboardFilters, period_id: UUID | None = None
) -> list[AccountRagRow]:
    accounts = await account_health_rows(db, filters)
    if not accounts:
        return []
    account_ids = [a.account_id for a in accounts]

    geo_rows = (
        await db.execute(
            select(Account.id, Geo.name).outerjoin(Geo, Geo.id == Account.geo_id).where(Account.id.in_(account_ids))
        )
    ).all()
    geo_by_account = dict(geo_rows)

    decl_conditions = [AccountHealthDeclaration.account_id.in_(account_ids)]
    if period_id is not None:
        decl_conditions.append(AccountHealthDeclaration.period_id == period_id)
    declarations = (await db.execute(select(AccountHealthDeclaration).where(*decl_conditions))).scalars().all()
    latest: dict[UUID, AccountHealthDeclaration] = {}
    for decl in declarations:
        current = latest.get(decl.account_id)
        if current is None or decl.created_at > current.created_at:
            latest[decl.account_id] = decl

    period_ids = {decl.period_id for decl in latest.values()}
    period_labels: dict[UUID, str] = {}
    if period_ids:
        period_rows = (
            await db.execute(
                select(ReportingPeriod.id, ReportingPeriod.label).where(ReportingPeriod.id.in_(period_ids))
            )
        ).all()
        period_labels = dict(period_rows)

    rows: list[AccountRagRow] = []
    for a in accounts:
        decl = latest.get(a.account_id)
        rows.append(
            AccountRagRow(
                account_id=a.account_id,
                account_name=a.account_name,
                geo_name=geo_by_account.get(a.account_id),
                project_count=a.project_count,
                overall_rating=decl.overall_rating if decl else None,
                core_delivery_rating=decl.core_delivery_rating if decl else None,
                people_rating=decl.people_rating if decl else None,
                operational_rating=decl.operational_rating if decl else None,
                customer_rating=decl.customer_rating if decl else None,
                financial_rating=decl.financial_rating if decl else None,
                compliance_rating=decl.compliance_rating if decl else None,
                period_label=period_labels.get(decl.period_id) if decl else None,
                last_updated=decl.created_at if decl else None,
            )
        )
    return sorted(rows, key=lambda r: r.account_name)


async def list_risks_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[RiskRow], int]:
    conditions = [RiskLog.project_id.in_(await _matching_project_ids(db, filters))]
    if search:
        conditions.append(RiskLog.risk_title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(RiskLog).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(RiskLog, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name, User.full_name)
            .outerjoin(Project, Project.id == RiskLog.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(User, User.id == RiskLog.risk_owner)
            .where(*conditions)
            .order_by(RiskLog.target_resolution_date)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    items = [
        RiskRow(
            project_id=risk.project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(risk.project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            risk_id=risk.id,
            risk_title=risk.risk_title,
            risk_category=risk.risk_category,
            probability=risk.probability,
            impact=risk.impact,
            severity=risk.severity,
            mitigation_plan=risk.mitigation_plan,
            owner_name=owner_name,
            target_resolution_date=risk.target_resolution_date,
            current_status=risk.current_status,
        )
        for risk, project_code, project_name, geo_name, region_name, account_name, owner_name in rows
    ]
    return items, total


async def list_issues_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[IssueRow], int]:
    conditions = [IssueLog.project_id.in_(await _matching_project_ids(db, filters))]
    if search:
        conditions.append(IssueLog.issue_title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(IssueLog).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(IssueLog, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name, User.full_name)
            .outerjoin(Project, Project.id == IssueLog.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(User, User.id == IssueLog.assigned_to)
            .where(*conditions)
            .order_by(IssueLog.due_date)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    today = date.today()
    items = [
        IssueRow(
            project_id=issue.project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(issue.project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            issue_id=issue.id,
            issue_title=issue.issue_title,
            issue_category=issue.issue_category,
            severity=issue.severity,
            owner_name=owner_name,
            due_date=issue.due_date,
            age_days=(today - issue.raised_date).days if issue.raised_date else None,
            status=issue.status,
        )
        for issue, project_code, project_name, geo_name, region_name, account_name, owner_name in rows
    ]
    return items, total


async def dependency_card_summary(db: AsyncSession, filters: DashboardFilters) -> DependencyCardSummary:
    project_ids = await _matching_project_ids(db, filters)
    today = date.today()
    open_condition = [
        DependencyLog.project_id.in_(project_ids),
        DependencyLog.dependency_status != DependencyStatus.COMPLETED,
    ]

    open_count = (await db.execute(select(func.count()).select_from(DependencyLog).where(*open_condition))).scalar_one()
    overdue_count = (
        await db.execute(
            select(func.count())
            .select_from(DependencyLog)
            .where(
                *open_condition, DependencyLog.required_by_date.is_not(None), DependencyLog.required_by_date < today
            )
        )
    ).scalar_one()
    critical_count = (
        await db.execute(
            select(func.count())
            .select_from(DependencyLog)
            .where(*open_condition, DependencyLog.criticality == Criticality.CRITICAL)
        )
    ).scalar_one()

    return DependencyCardSummary(open_count=open_count, overdue_count=overdue_count, critical_count=critical_count)


async def list_dependencies_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[DependencyRow], int]:
    conditions = [DependencyLog.project_id.in_(await _matching_project_ids(db, filters))]
    if search:
        conditions.append(DependencyLog.dependency_title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(DependencyLog).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(DependencyLog, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name, User.full_name)
            .outerjoin(Project, Project.id == DependencyLog.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(User, User.id == DependencyLog.owner)
            .where(*conditions)
            .order_by(DependencyLog.required_by_date)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    items = [
        DependencyRow(
            project_id=dep.project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(dep.project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            dependency_id=dep.id,
            dependency_title=dep.dependency_title,
            category=dep.category,
            depends_on=dep.depends_on,
            owner_name=owner_name,
            due_date=dep.required_by_date,
            status=dep.dependency_status,
        )
        for dep, project_code, project_name, geo_name, region_name, account_name, owner_name in rows
    ]
    return items, total


# AssumptionLog has no next_review_date (unlike Risk/Issue/Dependency/
# Opportunity), so "Review Due"/"Overdue" are approximated off
# validation_status/validation_date instead: Review Due = open + still
# Pending validation, Overdue = Review Due + its validation_date has passed.
async def assumption_card_summary(db: AsyncSession, filters: DashboardFilters) -> AssumptionCardSummary:
    project_ids = await _matching_project_ids(db, filters)
    today = date.today()
    open_condition = [AssumptionLog.project_id.in_(project_ids), AssumptionLog.current_status == AssumptionStatus.OPEN]

    open_count = (await db.execute(select(func.count()).select_from(AssumptionLog).where(*open_condition))).scalar_one()
    review_due_condition = [*open_condition, AssumptionLog.validation_status == ValidationStatus.PENDING]
    review_due_count = (
        await db.execute(select(func.count()).select_from(AssumptionLog).where(*review_due_condition))
    ).scalar_one()
    overdue_count = (
        await db.execute(
            select(func.count())
            .select_from(AssumptionLog)
            .where(*review_due_condition, AssumptionLog.validation_date.is_not(None), AssumptionLog.validation_date < today)
        )
    ).scalar_one()

    return AssumptionCardSummary(open_count=open_count, review_due_count=review_due_count, overdue_count=overdue_count)


async def list_assumptions_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[AssumptionRow], int]:
    conditions = [AssumptionLog.project_id.in_(await _matching_project_ids(db, filters))]
    if search:
        conditions.append(AssumptionLog.title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(AssumptionLog).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(AssumptionLog, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name, User.full_name)
            .outerjoin(Project, Project.id == AssumptionLog.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(User, User.id == AssumptionLog.owner)
            .where(*conditions)
            .order_by(AssumptionLog.validation_date)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    items = [
        AssumptionRow(
            project_id=a.project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(a.project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            assumption_id=a.id,
            title=a.title,
            owner_name=owner_name,
            review_date=a.validation_date,
            status=a.current_status,
        )
        for a, project_code, project_name, geo_name, region_name, account_name, owner_name in rows
    ]
    return items, total


# OpportunityLog has no priority field (only impact) and OpportunityStatus has
# no "Under Review" value — "High Priority" maps to impact == High, and the
# mockup's "Under Review" is renamed to "Pending Approval", reusing the exact
# condition count_pending_approvals/_pending_opportunities_count already use.
async def opportunity_card_summary(db: AsyncSession, filters: DashboardFilters) -> OpportunityCardSummary:
    project_ids = await _matching_project_ids(db, filters)
    open_condition = [
        OpportunityLog.project_id.in_(project_ids),
        OpportunityLog.status.in_([OpportunityStatus.IDENTIFIED, OpportunityStatus.APPROVED]),
    ]

    open_count = (await db.execute(select(func.count()).select_from(OpportunityLog).where(*open_condition))).scalar_one()
    high_priority_count = (
        await db.execute(
            select(func.count())
            .select_from(OpportunityLog)
            .where(*open_condition, OpportunityLog.impact == OpportunityImpact.HIGH)
        )
    ).scalar_one()
    pending_approval_count = await _pending_opportunities_count(db, project_ids)

    return OpportunityCardSummary(
        open_count=open_count, high_priority_count=high_priority_count, pending_approval_count=pending_approval_count
    )


async def list_opportunities_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[OpportunityRow], int]:
    conditions = [OpportunityLog.project_id.in_(await _matching_project_ids(db, filters))]
    if search:
        conditions.append(OpportunityLog.opportunity_title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(OpportunityLog).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(OpportunityLog, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name, User.full_name)
            .outerjoin(Project, Project.id == OpportunityLog.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(User, User.id == OpportunityLog.opportunity_owner)
            .where(*conditions)
            .order_by(OpportunityLog.target_implementation_date)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    items = [
        OpportunityRow(
            project_id=o.project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(o.project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            opportunity_id=o.id,
            opportunity_title=o.opportunity_title,
            category=o.category,
            priority=o.impact,
            owner_name=owner_name,
            target_date=o.target_implementation_date,
            status=o.status,
        )
        for o, project_code, project_name, geo_name, region_name, account_name, owner_name in rows
    ]
    return items, total


async def payment_milestones_card_summary(db: AsyncSession, filters: DashboardFilters) -> PaymentMilestonesCardSummary:
    base = await milestone_payment_summary(db, filters)
    project_ids = await _matching_project_ids(db, filters)
    value_due_stmt = (
        select(func.coalesce(func.sum(MilestonePayment.expected_payment_value), 0))
        .select_from(MilestonePayment)
        .outerjoin(MilestonePaymentActual, MilestonePaymentActual.milestone_id == MilestonePayment.id)
        .where(MilestonePayment.project_id.in_(project_ids), MilestonePaymentActual.actual_date_of_payment.is_(None))
    )
    value_due = (await db.execute(value_due_stmt)).scalar_one()
    return PaymentMilestonesCardSummary(
        value_due=Decimal(value_due), due_count=base.upcoming_count, overdue_count=base.overdue_count
    )


async def list_payment_milestones_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[PaymentMilestoneRow], int]:
    conditions = [MilestonePayment.project_id.in_(await _matching_project_ids(db, filters))]
    if search:
        conditions.append(MilestonePayment.milestone_name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(MilestonePayment).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(
                MilestonePayment,
                Project.project_code,
                Project.project_name,
                Geo.name,
                Region.name,
                Account.name,
                Project.project_currency,
                MilestonePaymentActual.actual_date_of_payment,
                MilestonePaymentActual.status,
            )
            .outerjoin(Project, Project.id == MilestonePayment.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(MilestonePaymentActual, MilestonePaymentActual.milestone_id == MilestonePayment.id)
            .where(*conditions)
            .order_by(MilestonePayment.expected_date_of_payment)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    items = [
        PaymentMilestoneRow(
            project_id=milestone.project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(milestone.project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            milestone_id=milestone.id,
            milestone_name=milestone.milestone_name,
            amount=milestone.expected_payment_value,
            currency=currency,
            planned_date=milestone.expected_date_of_payment,
            actual_date=actual_date,
            status=status or "Pending",
        )
        for milestone, project_code, project_name, geo_name, region_name, account_name, currency, actual_date, status in rows
    ]
    return items, total


# ContractualCommitment has no due-date field of its own — "Due Soon"/
# "Overdue" is a cadence-window proxy: next-expected-date = the commitment's
# latest recorded actual + a window derived from its reporting frequency
# (same cadence-window idiom services/data_integrity_rollup.py's
# _CADENCE_WINDOW_DAYS already uses for staleness), so a commitment with no
# recorded actual yet, or a One Time/Phase Wise commitment with no fixed
# calendar cadence, is never flagged due/overdue by this proxy.
_COMMITMENT_CADENCE_WINDOW_DAYS: dict[str, int | None] = {
    "One Time": None,
    "Weekly": 7,
    "Fortnight": 14,
    "Monthly": 31,
    "Quarterly": 92,
    "Half Yearly": 183,
    "Phase Wise": None,
}
_COMMITMENT_DUE_SOON_DAYS = 7


async def commitments_card_summary(db: AsyncSession, filters: DashboardFilters) -> CommitmentsCardSummary:
    project_ids = await _matching_project_ids(db, filters)

    commitments = (
        await db.execute(
            select(ContractualCommitment.id, ContractualCommitment.frequency).where(
                ContractualCommitment.project_id.in_(project_ids)
            )
        )
    ).all()
    if not commitments:
        return CommitmentsCardSummary(open_count=0, due_soon_count=0, overdue_count=0, breached_count=0)
    commitment_ids = [c[0] for c in commitments]
    frequency_by_commitment = dict(commitments)

    latest_actual_dates = dict(
        (
            await db.execute(
                select(
                    ContractualCommitmentActual.commitment_id,
                    func.max(ContractualCommitmentActual.period_date),
                )
                .where(ContractualCommitmentActual.commitment_id.in_(commitment_ids))
                .group_by(ContractualCommitmentActual.commitment_id)
            )
        ).all()
    )

    latest_actual_subq = (
        select(
            ContractualCommitmentActual.commitment_id,
            func.max(ContractualCommitmentActual.period_date).label("latest_date"),
        )
        .where(ContractualCommitmentActual.commitment_id.in_(commitment_ids))
        .group_by(ContractualCommitmentActual.commitment_id)
        .subquery()
    )
    latest_status_by_commitment = dict(
        (
            await db.execute(
                select(ContractualCommitmentActual.commitment_id, ContractualCommitmentActual.met_status).join(
                    latest_actual_subq,
                    (ContractualCommitmentActual.commitment_id == latest_actual_subq.c.commitment_id)
                    & (ContractualCommitmentActual.period_date == latest_actual_subq.c.latest_date),
                )
            )
        ).all()
    )

    today = date.today()
    open_count = due_soon_count = overdue_count = breached_count = 0
    for commitment_id, frequency in frequency_by_commitment.items():
        latest_status = latest_status_by_commitment.get(commitment_id)
        if latest_status != "Met":
            open_count += 1
        if latest_status == "Breached":
            breached_count += 1

        window = _COMMITMENT_CADENCE_WINDOW_DAYS.get(frequency)
        latest_date = latest_actual_dates.get(commitment_id)
        if window is None or latest_date is None:
            continue
        days_out = (latest_date + timedelta(days=window) - today).days
        if days_out < 0:
            overdue_count += 1
        elif days_out <= _COMMITMENT_DUE_SOON_DAYS:
            due_soon_count += 1

    return CommitmentsCardSummary(
        open_count=open_count,
        due_soon_count=due_soon_count,
        overdue_count=overdue_count,
        breached_count=breached_count,
    )


async def list_commitments_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int, search: str | None = None
) -> tuple[list[CommitmentRow], int]:
    conditions = [ContractualCommitment.project_id.in_(await _matching_project_ids(db, filters))]
    if search:
        conditions.append(ContractualCommitment.commitment_name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(ContractualCommitment).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(ContractualCommitment, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name)
            .outerjoin(Project, Project.id == ContractualCommitment.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .where(*conditions)
            .order_by(ContractualCommitment.commitment_name)
            .offset(skip)
            .limit(limit)
        )
    ).all()
    if not rows:
        return [], total

    commitment_ids = [c.id for c, *_ in rows]
    latest_subq = (
        select(
            ContractualCommitmentActual.commitment_id,
            func.max(ContractualCommitmentActual.period_date).label("latest_date"),
        )
        .where(ContractualCommitmentActual.commitment_id.in_(commitment_ids))
        .group_by(ContractualCommitmentActual.commitment_id)
        .subquery()
    )
    latest_actuals = (
        await db.execute(
            select(
                ContractualCommitmentActual.commitment_id,
                ContractualCommitmentActual.period_date,
                ContractualCommitmentActual.met_status,
            ).join(
                latest_subq,
                (ContractualCommitmentActual.commitment_id == latest_subq.c.commitment_id)
                & (ContractualCommitmentActual.period_date == latest_subq.c.latest_date),
            )
        )
    ).all()
    latest_by_commitment = {row[0]: (row[1], row[2]) for row in latest_actuals}

    items = []
    for commitment, project_code, project_name, geo_name, region_name, account_name in rows:
        latest_date, met_status = latest_by_commitment.get(commitment.id, (None, None))
        window = _COMMITMENT_CADENCE_WINDOW_DAYS.get(commitment.frequency)
        due_date = latest_date + timedelta(days=window) if (window is not None and latest_date is not None) else None
        items.append(
            CommitmentRow(
                project_id=commitment.project_id,
                project_label=f"{project_code} · {project_name}" if project_code else str(commitment.project_id),
                geo_name=geo_name,
                region_name=region_name,
                account_name=account_name,
                commitment_id=commitment.id,
                commitment_name=commitment.commitment_name,
                type=commitment.frequency,
                owner_name=None,
                due_date=due_date,
                actual_date=latest_date,
                status=met_status or "Pending",
            )
        )
    return items, total


# Org-wide when no geo/account/project-type filter narrows the project set
# (every Action regardless of level, like count_overdue_actions); once a
# filter is active, restricted to PROJECT-level actions on the in-scope
# projects (same restriction attention_required already uses) —
# GEO/ACCOUNT-level actions can't be intersected with a project-id filter
# since Action.level_value has no FK back to geo/account, so they're excluded
# from filtered counts.
async def actions_card_summary(
    db: AsyncSession, filters: DashboardFilters, project_ids: list[UUID]
) -> ActionsCardSummary:
    today = date.today()
    week_out = today + timedelta(days=7)
    is_filtered = filters.geo_id is not None or filters.account_id is not None or filters.project_type_id is not None

    conditions = [Action.status.not_in([ActionStatus.COMPLETED, ActionStatus.CLOSED, ActionStatus.CANCELLED])]
    if is_filtered:
        conditions += [Action.level == ActionLevel.PROJECT, Action.level_value.in_([str(pid) for pid in project_ids])]

    rows = (await db.execute(select(Action.status, Action.due_date).where(*conditions))).all()

    open_count = len(rows)
    in_progress_count = sum(1 for status, _ in rows if status == ActionStatus.IN_PROGRESS)
    overdue_count = sum(1 for _, due_date in rows if due_date < today)
    due_this_week_count = sum(1 for _, due_date in rows if today <= due_date <= week_out)

    return ActionsCardSummary(
        open_count=open_count,
        in_progress_count=in_progress_count,
        overdue_count=overdue_count,
        due_this_week_count=due_this_week_count,
    )


# Action.level_value is a raw string id (see actions_card_summary's own
# str(pid) comparison above) with no FK — which of Geo/Account/Project it
# names depends on Action.level, so display names are resolved with one
# batched lookup per level type rather than a single SQL join.
async def list_actions_for_health(
    db: AsyncSession, filters: DashboardFilters, project_ids: list[UUID], skip: int, limit: int, search: str | None = None
) -> tuple[list[ActionRow], int]:
    is_filtered = filters.geo_id is not None or filters.account_id is not None or filters.project_type_id is not None
    conditions = [Action.status.not_in([ActionStatus.COMPLETED, ActionStatus.CLOSED, ActionStatus.CANCELLED])]
    if is_filtered:
        conditions += [Action.level == ActionLevel.PROJECT, Action.level_value.in_([str(pid) for pid in project_ids])]
    if search:
        conditions.append(Action.title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(Action).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(Action, User.full_name)
            .outerjoin(User, User.id == Action.action_by_id)
            .where(*conditions)
            .order_by(Action.due_date)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    def as_uuid(value: str) -> UUID | None:
        try:
            return UUID(value)
        except ValueError:
            return None

    geo_ids = [uid for a, _ in rows if a.level == ActionLevel.GEO and (uid := as_uuid(a.level_value))]
    account_ids = [uid for a, _ in rows if a.level == ActionLevel.ACCOUNT and (uid := as_uuid(a.level_value))]
    proj_ids = [uid for a, _ in rows if a.level == ActionLevel.PROJECT and (uid := as_uuid(a.level_value))]

    geo_names = dict((await db.execute(select(Geo.id, Geo.name).where(Geo.id.in_(geo_ids)))).all()) if geo_ids else {}
    account_names = (
        dict((await db.execute(select(Account.id, Account.name).where(Account.id.in_(account_ids)))).all())
        if account_ids
        else {}
    )
    project_rows = (
        (await db.execute(select(Project.id, Project.project_code, Project.project_name).where(Project.id.in_(proj_ids))))
        .all()
        if proj_ids
        else []
    )
    project_labels = {pid: f"{code} · {name}" for pid, code, name in project_rows}

    def scope_label(action: Action) -> str:
        entity_id = as_uuid(action.level_value)
        if entity_id is None:
            return action.level_value
        if action.level == ActionLevel.GEO:
            return geo_names.get(entity_id, action.level_value)
        if action.level == ActionLevel.ACCOUNT:
            return account_names.get(entity_id, action.level_value)
        return project_labels.get(entity_id, action.level_value)

    today = date.today()
    items = [
        ActionRow(
            action_id=action.id,
            level=action.level,
            scope_label=scope_label(action),
            title=action.title,
            assigned_to_name=assigned_to_name,
            due_date=action.due_date,
            age_days=(today - action.raised_at.date()).days,
            status=action.status,
        )
        for action, assigned_to_name in rows
    ]
    return items, total


async def findings_card_summary(
    db: AsyncSession, filters: DashboardFilters, period: ReportingPeriod | None
) -> FindingsCardSummary:
    findings_by_project = await de_findings_by_project(db, filters)
    findings = [f for project_findings in findings_by_project.values() for f in project_findings]
    awaiting_closure_count = sum(1 for f in findings if f.status in (FindingStatus.ON_HOLD, FindingStatus.DEFERRED))

    if period is None:
        return FindingsCardSummary(
            open_count=0, new_this_period_count=0, overdue_count=0, awaiting_closure_count=awaiting_closure_count
        )

    base = de_findings_summary(findings_by_project, period)
    return FindingsCardSummary(
        open_count=base.open_count,
        new_this_period_count=base.new_this_period_count,
        overdue_count=base.overdue_count,
        awaiting_closure_count=awaiting_closure_count,
    )


# DEAssessmentFinding has no title/owner/due-date fields — "Finding" is
# derived from classification + date, and Owner/Due Date are left blank
# (there's nothing on the model to source them from).
async def list_findings_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int
) -> tuple[list[FindingRow], int]:
    project_ids = await _matching_project_ids(db, filters)
    conditions = [DEAssessmentFinding.project_id.in_(project_ids)]

    total = (
        await db.execute(
            select(func.count()).select_from(DEAssessmentFinding).where(*conditions)
        )
    ).scalar_one()
    rows = (
        await db.execute(
            select(
                DEAssessmentFinding,
                DEAssessmentFinding.project_id,
                Project.project_code,
                Project.project_name,
                Geo.name,
                Region.name,
                Account.name,
            )
            .outerjoin(Project, Project.id == DEAssessmentFinding.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .where(*conditions)
            .order_by(DEAssessmentFinding.finding_date.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()

    today = date.today()
    items = [
        FindingRow(
            project_id=project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            finding_id=finding.id,
            finding_title=(
                f"{finding.category} — {finding.finding_date}" if finding.finding_date else finding.category
            ),
            category=finding.category,
            classification=finding.classification,
            action_taken=finding.action_taken,
            owner_name=None,
            due_date=None,
            age_days=(today - finding.finding_date).days if finding.finding_date else None,
            status=finding.status,
        )
        for finding, project_id, project_code, project_name, geo_name, region_name, account_name in rows
    ]
    return items, total


async def de_assessments_card_summary(
    db: AsyncSession, filters: DashboardFilters, project_ids: list[UUID], period: ReportingPeriod | None
) -> DEAssessmentsCardSummary:
    due_count = await count_assessments_overdue(db, project_ids)
    if period is None:
        return DEAssessmentsCardSummary(completed_count=0, avg_pci_score=None, due_count=due_count, red_amber_count=0)

    assessments = (
        await db.execute(
            select(DEAssessment).where(
                DEAssessment.project_id.in_(project_ids),
                DEAssessment.assessment_date >= period.start_date,
                DEAssessment.assessment_date <= period.end_date,
            )
        )
    ).scalars().all()
    latest_by_project: dict[UUID, DEAssessment] = {}
    for a in assessments:
        current = latest_by_project.get(a.project_id)
        if current is None or a.assessment_date > current.assessment_date:
            latest_by_project[a.project_id] = a

    scores = [a.pci_score for a in latest_by_project.values() if a.pci_score is not None]
    red_amber_count = sum(
        1
        for a in latest_by_project.values()
        if a.de_assessed_project_health in (HealthRating.AMBER, HealthRating.RED, HealthRating.POTENTIAL_RED)
    )

    return DEAssessmentsCardSummary(
        completed_count=len(latest_by_project),
        avg_pci_score=round(sum(scores) / len(scores), 1) if scores else None,
        due_count=due_count,
        red_amber_count=red_amber_count,
    )


# "Project Manager Health" (grid column, distinct from DE's own assessed
# health) comes from Project.delivery_declared_overall_health — the PM's own
# self-declared rating, same field the portfolio dashboard's health matrix
# tracks alongside the DE-assessed one.
async def list_assessments_for_health(
    db: AsyncSession, filters: DashboardFilters, skip: int, limit: int
) -> tuple[list[AssessmentRow], int]:
    conditions = [DEAssessment.project_id.in_(await _matching_project_ids(db, filters))]

    total = (await db.execute(select(func.count()).select_from(DEAssessment).where(*conditions))).scalar_one()
    rows = (
        await db.execute(
            select(
                DEAssessment,
                Project.project_code,
                Project.project_name,
                Geo.name,
                Region.name,
                Account.name,
                Project.delivery_declared_overall_health,
                User.full_name,
            )
            .outerjoin(Project, Project.id == DEAssessment.project_id)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .outerjoin(User, User.id == DEAssessment.assessed_by)
            .where(*conditions)
            .order_by(DEAssessment.assessment_date.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()

    periods = (await db.execute(select(ReportingPeriod))).scalars().all()

    def period_label_for(d: date | None) -> str | None:
        if d is None:
            return None
        for p in periods:
            if p.start_date <= d <= p.end_date:
                return p.label
        return None

    items = [
        AssessmentRow(
            project_id=a.project_id,
            project_label=f"{project_code} · {project_name}" if project_code else str(a.project_id),
            geo_name=geo_name,
            region_name=region_name,
            account_name=account_name,
            assessment_id=a.id,
            pm_health=pm_health,
            de_health=a.de_assessed_project_health,
            pci_score=a.pci_score,
            assessment_period=period_label_for(a.assessment_date),
            assessed_by_name=assessed_by_name,
            status="Compliant" if a.de_assessed_project_health == HealthRating.GREEN else "Red/Amber",
        )
        for a, project_code, project_name, geo_name, region_name, account_name, pm_health, assessed_by_name in rows
    ]
    return items, total


# Metrics compliance card — no generic "Metric" table exists, so a project's
# discipline is whichever Measurement*/MetricTarget* pair has a row for it
# (a project only ever fills in the one matching its project_type, same
# discovery _projects_with_measurement_for_period uses). Each discipline's
# actual/target field pairs are compared with an explicit higher-is-better/
# lower-is-better direction per field (there's no single "bigger is better"
# rule across e.g. productivity vs defect leakage), reduced per project via
# "worst wins" (same idiom _worst_governance_status uses), then rolled up to
# the card's 4 buckets.
_METRIC_FIELD_SPECS: dict[str, list[tuple[str, str, str]]] = {
    "development": [
        ("productivity", "target_productivity", "higher_better"),
        ("effort_variation_pct", "target_effort_variation_pct", "lower_better"),
        ("schedule_performance_index", "target_schedule_performance_index", "higher_better"),
        ("cost_performance_index", "target_cost_performance_index", "higher_better"),
        ("defect_leakage_pct", "target_defect_leakage_pct", "lower_better"),
        ("code_coverage_pct", "target_code_coverage_pct", "higher_better"),
        ("test_execution_coverage_pct", "target_test_execution_coverage_pct", "higher_better"),
        ("test_pass_rate_pct", "target_test_pass_rate_pct", "higher_better"),
    ],
    "support": [
        ("incident_sla_compliance_p1_pct", "target_incident_sla_compliance_p1_pct", "higher_better"),
        ("incident_sla_compliance_p2_pct", "target_incident_sla_compliance_p2_pct", "higher_better"),
        ("incident_sla_compliance_p3_pct", "target_incident_sla_compliance_p3_pct", "higher_better"),
        ("incident_mttr_p1_hours", "target_incident_mttr_p1_hours", "lower_better"),
        ("incident_mttr_p2_hours", "target_incident_mttr_p2_hours", "lower_better"),
        ("incident_mttr_p3_hours", "target_incident_mttr_p3_hours", "lower_better"),
        ("service_request_mttr_hours", "target_service_request_mttr_hours", "lower_better"),
        ("user_clarification_mttr_hours", "target_user_clarification_mttr_hours", "lower_better"),
    ],
    "staffing": [
        ("pct_profiles_qualifying", "target_pct_profiles_qualifying", "higher_better"),
        ("pct_candidates_joining", "target_pct_candidates_joining", "higher_better"),
    ],
    "testing": [
        ("test_execution_coverage_pct", "target_test_execution_coverage_pct", "higher_better"),
        ("test_pass_rate_pct", "target_test_pass_rate_pct", "higher_better"),
        ("automation_coverage_pct", "target_automation_coverage_pct", "higher_better"),
        ("test_design_productivity", "target_test_design_productivity", "higher_better"),
        ("test_execution_productivity", "target_test_execution_productivity", "higher_better"),
    ],
    "cloud_maintenance": [
        ("service_availability_pct", "target_service_availability_pct", "higher_better"),
        ("application_availability_pct", "target_application_availability_pct", "higher_better"),
    ],
    "cloud_migration": [
        ("applications_migrated_pct", "target_applications_migrated_pct", "higher_better"),
        ("migration_success_rate_pct", "target_migration_success_rate_pct", "higher_better"),
        ("migration_downtime_hours", "target_migration_downtime_hours", "lower_better"),
    ],
}

# A field misses its target by more than this percentage of the target's own
# magnitude before it's "Critical Variance" rather than just "Below Target".
_CRITICAL_VARIANCE_THRESHOLD_PCT = Decimal("20")

_METRIC_STATUS_SEVERITY = {"Critical Variance": 0, "Below Target": 1, "Compliant": 2}


def _metric_field_status(actual: Decimal | None, target: Decimal | None, direction: str) -> str | None:
    if actual is None or target is None or target == 0:
        return None
    if direction == "higher_better":
        if actual >= target:
            return "Compliant"
        variance_pct = (target - actual) / abs(target) * 100
    else:
        if actual <= target:
            return "Compliant"
        variance_pct = (actual - target) / abs(target) * 100
    return "Critical Variance" if variance_pct > _CRITICAL_VARIANCE_THRESHOLD_PCT else "Below Target"


# project_id -> Compliant | Below Target | Critical Variance | Not Reported
# (a project with a measurement row for the period but no matching target row
# set also counts as Not Reported — there's nothing to assess compliance
# against). A project absent from the returned dict submitted no measurement
# at all for the period.
async def _project_metrics_status(
    db: AsyncSession, project_ids: list[UUID], period: ReportingPeriod
) -> dict[UUID, str]:
    if not project_ids:
        return {}

    discipline_tables = [
        ("development", MeasurementDevelopment, MetricTargetDevelopment, "period"),
        ("support", MeasurementSupport, MetricTargetSupport, "period"),
        ("staffing", MeasurementStaffing, MetricTargetStaffing, "period"),
        ("testing", MeasurementTesting, MetricTargetTesting, "period"),
        ("cloud_maintenance", MeasurementCloudMaintenance, MetricTargetCloudMaintenance, "period"),
        ("cloud_migration", MeasurementCloudMigration, MetricTargetCloudMigration, "as_of_date"),
    ]

    statuses: dict[UUID, str] = {}
    for key, measurement_model, target_model, date_mode in discipline_tables:
        if date_mode == "period":
            measurement_stmt = select(measurement_model).where(
                measurement_model.project_id.in_(project_ids), measurement_model.period_id == period.id
            )
        else:
            measurement_stmt = select(measurement_model).where(
                measurement_model.project_id.in_(project_ids),
                measurement_model.as_of_date >= period.start_date,
                measurement_model.as_of_date <= period.end_date,
            )
        measurements = (await db.execute(measurement_stmt)).scalars().all()
        if not measurements:
            continue

        discipline_project_ids = [m.project_id for m in measurements]
        targets = (
            await db.execute(select(target_model).where(target_model.project_id.in_(discipline_project_ids)))
        ).scalars().all()
        targets_by_project = {t.project_id: t for t in targets}

        for measurement in measurements:
            target = targets_by_project.get(measurement.project_id)
            field_statuses = [
                status
                for actual_attr, target_attr, direction in _METRIC_FIELD_SPECS[key]
                if (
                    status := _metric_field_status(
                        getattr(measurement, actual_attr), getattr(target, target_attr) if target else None, direction
                    )
                )
                is not None
            ]
            statuses[measurement.project_id] = (
                min(field_statuses, key=lambda s: _METRIC_STATUS_SEVERITY[s]) if field_statuses else "Not Reported"
            )

    return statuses


async def metrics_compliance_summary(
    db: AsyncSession, filters: DashboardFilters, project_ids: list[UUID], period: ReportingPeriod | None
) -> MetricsComplianceSummary:
    if period is None or not project_ids:
        return MetricsComplianceSummary(
            compliant_pct=0, below_target_count=0, not_reported_count=len(project_ids), critical_variance_count=0
        )

    statuses = await _project_metrics_status(db, project_ids, period)
    counts = Counter(statuses.values())
    not_reported_count = (len(project_ids) - len(statuses)) + counts.get("Not Reported", 0)

    return MetricsComplianceSummary(
        compliant_pct=round((counts.get("Compliant", 0) / len(project_ids)) * 100),
        below_target_count=counts.get("Below Target", 0),
        not_reported_count=not_reported_count,
        critical_variance_count=counts.get("Critical Variance", 0),
    )


_METRIC_LABELS: dict[str, str] = {
    "productivity": "Productivity",
    "effort_variation_pct": "Effort Variation %",
    "schedule_performance_index": "Schedule Performance Index",
    "cost_performance_index": "Cost Performance Index",
    "defect_leakage_pct": "Defect Leakage %",
    "code_coverage_pct": "Code Coverage %",
    "test_execution_coverage_pct": "Test Execution Coverage %",
    "test_pass_rate_pct": "Test Pass Rate %",
    "incident_sla_compliance_p1_pct": "Incident SLA Compliance (P1) %",
    "incident_sla_compliance_p2_pct": "Incident SLA Compliance (P2) %",
    "incident_sla_compliance_p3_pct": "Incident SLA Compliance (P3) %",
    "incident_mttr_p1_hours": "Incident MTTR (P1) (hrs)",
    "incident_mttr_p2_hours": "Incident MTTR (P2) (hrs)",
    "incident_mttr_p3_hours": "Incident MTTR (P3) (hrs)",
    "service_request_mttr_hours": "Service Request MTTR (hrs)",
    "user_clarification_mttr_hours": "User Clarification MTTR (hrs)",
    "pct_profiles_qualifying": "Profiles Qualifying %",
    "pct_candidates_joining": "Candidates Joining %",
    "automation_coverage_pct": "Automation Coverage %",
    "test_design_productivity": "Test Design Productivity",
    "test_execution_productivity": "Test Execution Productivity",
    "service_availability_pct": "Service Availability %",
    "application_availability_pct": "Application Availability %",
    "applications_migrated_pct": "Applications Migrated %",
    "migration_success_rate_pct": "Migration Success Rate %",
    "migration_downtime_hours": "Migration Downtime (hrs)",
}


# One row per (project, metric field) with a submitted actual — flattens the
# same per-project "worst wins" pieces _project_metrics_status uses
# (_METRIC_FIELD_SPECS/_metric_field_status) instead of collapsing them to a
# single status. Portfolio-wide, so — like list_rag_rows — paginated in
# Python rather than SQL (small portfolio sizes, per this file's own module
# docstring).
async def list_metrics_for_health(
    db: AsyncSession, filters: DashboardFilters, project_ids: list[UUID], period: ReportingPeriod | None
) -> list[MetricRow]:
    if period is None or not project_ids:
        return []

    projects = (
        await db.execute(
            select(Project.id, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .where(Project.id.in_(project_ids))
        )
    ).all()
    project_label_by_id = {pid: f"{code} · {name}" for pid, code, name, _, _, _ in projects}
    geo_by_id = {pid: geo_name for pid, _, _, geo_name, _, _ in projects}
    region_by_id = {pid: region_name for pid, _, _, _, region_name, _ in projects}
    account_by_id = {pid: account_name for pid, _, _, _, _, account_name in projects}

    discipline_tables = [
        ("development", MeasurementDevelopment, MetricTargetDevelopment, "period"),
        ("support", MeasurementSupport, MetricTargetSupport, "period"),
        ("staffing", MeasurementStaffing, MetricTargetStaffing, "period"),
        ("testing", MeasurementTesting, MetricTargetTesting, "period"),
        ("cloud_maintenance", MeasurementCloudMaintenance, MetricTargetCloudMaintenance, "period"),
        ("cloud_migration", MeasurementCloudMigration, MetricTargetCloudMigration, "as_of_date"),
    ]

    rows: list[MetricRow] = []
    for key, measurement_model, target_model, date_mode in discipline_tables:
        if date_mode == "period":
            measurement_stmt = select(measurement_model).where(
                measurement_model.project_id.in_(project_ids), measurement_model.period_id == period.id
            )
        else:
            measurement_stmt = select(measurement_model).where(
                measurement_model.project_id.in_(project_ids),
                measurement_model.as_of_date >= period.start_date,
                measurement_model.as_of_date <= period.end_date,
            )
        measurements = (await db.execute(measurement_stmt)).scalars().all()
        if not measurements:
            continue

        discipline_project_ids = [m.project_id for m in measurements]
        targets = (
            await db.execute(select(target_model).where(target_model.project_id.in_(discipline_project_ids)))
        ).scalars().all()
        targets_by_project = {t.project_id: t for t in targets}

        for measurement in measurements:
            target = targets_by_project.get(measurement.project_id)
            for actual_attr, target_attr, direction in _METRIC_FIELD_SPECS[key]:
                actual = getattr(measurement, actual_attr)
                target_value = getattr(target, target_attr) if target else None
                status = _metric_field_status(actual, target_value, direction)
                if status is None:
                    continue

                variance_pct = None
                if target_value not in (None, 0):
                    if direction == "higher_better":
                        variance_pct = (target_value - actual) / abs(target_value) * 100
                    else:
                        variance_pct = (actual - target_value) / abs(target_value) * 100

                rows.append(
                    MetricRow(
                        project_id=measurement.project_id,
                        project_label=project_label_by_id.get(measurement.project_id, str(measurement.project_id)),
                        geo_name=geo_by_id.get(measurement.project_id),
                        region_name=region_by_id.get(measurement.project_id),
                        account_name=account_by_id.get(measurement.project_id),
                        metric_name=_METRIC_LABELS.get(actual_attr, actual_attr),
                        target=str(target_value) if target_value is not None else None,
                        actual=str(actual) if actual is not None else None,
                        variance=f"{variance_pct:.1f}%" if variance_pct is not None else None,
                        status=status,
                        period_label=period.label,
                    )
                )
    return rows


# Data Integrity card — an org-wide rollup of services/data_integrity_rollup.py's
# per-project compute_status_row, via its bulk sibling compute_status_rows_bulk
# (one batched query per distinct checklist module across every in-scope
# project, not one query per (project, item) pair).
async def data_integrity_card_summary(
    db: AsyncSession, filters: DashboardFilters, project_ids: list[UUID]
) -> DataIntegrityCardSummary:
    if not project_ids:
        return DataIntegrityCardSummary(overall_compliance_pct=0, projects_with_gaps_count=0, critical_gaps_count=0)

    items = (
        await db.execute(select(DataIntegrityChecklistItem).where(DataIntegrityChecklistItem.is_active.is_(True)))
    ).scalars().all()
    if not items:
        return DataIntegrityCardSummary(overall_compliance_pct=100, projects_with_gaps_count=0, critical_gaps_count=0)

    rows = await data_integrity_rollup.compute_status_rows_bulk(db, project_ids, items)
    items_by_id = {item.id: item for item in items}

    total = len(rows)
    updated = sum(1 for is_updated, _ in rows.values() if is_updated)
    projects_with_gaps: set[UUID] = set()
    critical_gaps_count = 0
    for (project_id, item_id), (is_updated, last_updated) in rows.items():
        if is_updated:
            continue
        projects_with_gaps.add(project_id)
        if data_integrity_rollup.is_critical_gap(last_updated, items_by_id[item_id].expected_cadence):
            critical_gaps_count += 1

    return DataIntegrityCardSummary(
        overall_compliance_pct=round((updated / total) * 100) if total else 0,
        projects_with_gaps_count=len(projects_with_gaps),
        critical_gaps_count=critical_gaps_count,
    )


# Full project x checklist-item compliance grid — same compute_status_rows_bulk
# call data_integrity_card_summary uses, just flattened to rows instead of
# rolled up to 3 counts. Paginated in Python like list_rag_rows/
# list_metrics_for_health (small portfolio sizes).
async def list_data_integrity_for_health(
    db: AsyncSession, filters: DashboardFilters, project_ids: list[UUID], skip: int, limit: int
) -> tuple[list[DataIntegrityRow], int]:
    if not project_ids:
        return [], 0

    items_cfg = (
        await db.execute(select(DataIntegrityChecklistItem).where(DataIntegrityChecklistItem.is_active.is_(True)))
    ).scalars().all()
    if not items_cfg:
        return [], 0

    projects = (
        await db.execute(
            select(Project.id, Project.project_code, Project.project_name, Geo.name, Region.name, Account.name)
            .outerjoin(Geo, Geo.id == Project.geo_id)
            .outerjoin(Region, Region.id == Project.region_id)
            .outerjoin(Account, Account.id == Project.account_id)
            .where(Project.id.in_(project_ids))
        )
    ).all()
    project_label_by_id = {pid: f"{code} · {name}" for pid, code, name, _, _, _ in projects}
    geo_by_id = {pid: geo_name for pid, _, _, geo_name, _, _ in projects}
    region_by_id = {pid: region_name for pid, _, _, _, region_name, _ in projects}
    account_by_id = {pid: account_name for pid, _, _, _, _, account_name in projects}

    status_rows = await data_integrity_rollup.compute_status_rows_bulk(db, project_ids, items_cfg)
    items_by_id = {item.id: item for item in items_cfg}

    all_rows: list[DataIntegrityRow] = []
    for (project_id, item_id), (is_updated, last_updated) in status_rows.items():
        item = items_by_id[item_id]
        issue = None
        if not is_updated:
            issue = "Never updated" if last_updated is None else f"No update since {last_updated.isoformat()}"
        all_rows.append(
            DataIntegrityRow(
                project_id=project_id,
                project_label=project_label_by_id.get(project_id, str(project_id)),
                geo_name=geo_by_id.get(project_id),
                region_name=region_by_id.get(project_id),
                account_name=account_by_id.get(project_id),
                item_id=item_id,
                check_name=item.item_name,
                category=item.module_name,
                status="Compliant" if is_updated else "Gap",
                issue=issue,
                last_checked=last_updated,
            )
        )

    all_rows.sort(key=lambda r: (r.project_label, r.category, r.check_name))
    total = len(all_rows)
    return all_rows[skip : skip + limit], total


# Nearest active reporting period regardless of type (Weekly/Monthly/Baseline)
# — same "min by end_date across every active period" idiom
# project_report_status/reporting_readiness already use, exposed as its own
# function for the Project Health dashboard's period selector.
async def nearest_active_period(db: AsyncSession) -> ReportingPeriod | None:
    periods = await _active_reporting_periods(db)
    if not periods:
        return None
    return min(periods, key=lambda p: p.end_date)
