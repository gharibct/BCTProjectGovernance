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

from app.models.account_health_declarations import AccountHealthDeclaration
from app.models.contractual import (
    ContractualCommitment,
    ContractualCommitmentActual,
    MilestonePayment,
    MilestonePaymentActual,
)
from app.models.de_assessment import DEAssessment, DEAssessmentAlert
from app.models.health_declarations import HealthDeclaration
from app.models.project_status import ProjectStatusItem
from app.models.projects import Project
from app.models.raid import IssueLog, OpportunityLog, RiskLog
from app.models.reference_data import Account, ProjectType
from app.models.regional_status import AccountStatusItem
from app.schemas.dashboard import (
    AccountHealthRow,
    ContractualComplianceSummary,
    HealthMatrixRow,
    HighlightRow,
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
    # Role-scoping for the Geo Head / Account Manager dashboards — a user can
    # own more than one geo/account (see user_geos/user_accounts), so these
    # are separate from the single-value filters above used by the generic
    # Dashboard page's manual filter dropdown.
    geo_ids: list[UUID] | None = None
    account_ids: list[UUID] | None = None


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
