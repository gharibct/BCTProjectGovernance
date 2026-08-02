"""Dashboard (UX §4.2) — a live aggregation over every other module, not its
own stored data. Grouping/rollup math that's awkward as pure SQL (account
health 'worst wins' across a variable number of projects) is done in Python
after a narrow query, since portfolio sizes for an internal PMO tool are small.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contractual import (
    ContractualCommitment,
    ContractualCommitmentActual,
    MilestonePayment,
    MilestonePaymentActual,
)
from app.models.de_assessment import DEAssessment, DEAssessmentAlert
from app.models.projects import Project
from app.models.raid import IssueLog, OpportunityLog, RiskLog
from app.models.reference_data import Account, ProjectType
from app.schemas.dashboard import (
    AccountHealthRow,
    ContractualComplianceSummary,
    MilestonePaymentSummary,
    ProjectHealthRow,
    ProjectTypeBreakdownRow,
)
from app.schemas.enums import HealthRating
from app.services.health_rollup import compute_overall_rating


@dataclass
class DashboardFilters:
    geo_id: UUID | None = None
    account_id: UUID | None = None
    project_type_id: UUID | None = None
    health_status: HealthRating | None = None


def _project_conditions(filters: DashboardFilters) -> list:
    conditions = []
    if filters.geo_id is not None:
        conditions.append(Project.geo_id == filters.geo_id)
    if filters.account_id is not None:
        conditions.append(Project.account_id == filters.account_id)
    if filters.project_type_id is not None:
        conditions.append(Project.project_type_id == filters.project_type_id)
    if filters.health_status is not None:
        conditions.append(Project.overall_project_health == filters.health_status)
    return conditions


async def _matching_project_ids(db: AsyncSession, filters: DashboardFilters):
    conditions = _project_conditions(filters)
    stmt = select(Project.id).where(*conditions) if conditions else select(Project.id)
    return stmt


async def count_active_projects(db: AsyncSession, filters: DashboardFilters) -> int:
    conditions = [*_project_conditions(filters), Project.project_status != "Closed"]
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
        Project.project_status != "Closed",
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


async def count_pending_approvals(db: AsyncSession, filters: DashboardFilters) -> int:
    """Opportunities awaiting approval + DE alerts on a project's most recent
    assessment where health still isn't Green (no explicit alert status field
    in the source schema, so 'open' is inferred as 'not yet superseded by a
    later Green assessment')."""

    project_ids = await _matching_project_ids(db, filters)

    opportunities_stmt = (
        select(func.count())
        .select_from(OpportunityLog)
        .where(
            OpportunityLog.project_id.in_(project_ids),
            OpportunityLog.approval_required.is_(True),
            OpportunityLog.status == "Identified",
        )
    )
    pending_opportunities = (await db.execute(opportunities_stmt)).scalar_one()

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
    stmt = select(Project.id, Project.project_code, Project.project_name, Project.overall_project_health).where(
        *conditions
    )
    rows = (await db.execute(stmt)).all()
    return [
        ProjectHealthRow(project_id=r[0], project_code=r[1], project_name=r[2], overall_project_health=r[3])
        for r in rows
    ]


async def account_health_rows(db: AsyncSession, filters: DashboardFilters) -> list[AccountHealthRow]:
    conditions = _project_conditions(filters)
    stmt = select(Project.account_id, Project.overall_project_health).where(
        Project.account_id.is_not(None), *conditions
    )
    rows = (await db.execute(stmt)).all()

    by_account: dict[UUID, list[HealthRating]] = defaultdict(list)
    counts: dict[UUID, int] = defaultdict(int)
    for account_id, health in rows:
        counts[account_id] += 1
        if health is not None:
            by_account[account_id].append(health)

    if not counts:
        return []

    account_names = dict(
        (await db.execute(select(Account.id, Account.name).where(Account.id.in_(counts.keys())))).all()
    )

    return [
        AccountHealthRow(
            account_id=account_id,
            account_name=account_names.get(account_id, "Unknown"),
            overall_health=compute_overall_rating(by_account[account_id]) if by_account[account_id] else None,
            project_count=counts[account_id],
        )
        for account_id in counts
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
    not_met_count = sum(1 for s in statuses if s == "Not Met")
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
