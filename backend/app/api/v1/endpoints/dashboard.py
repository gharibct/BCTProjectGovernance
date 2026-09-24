from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dataclasses import replace

from app.api.deps import PaginationParams, _role_code, get_current_user, pagination_params, require_role
from app.core.db import get_db
from app.models.reference_data import Account, ReportingPeriod
from app.models.users import User, UserAccount, UserGeo
from app.schemas.common import Page
from app.schemas.dashboard import (
    AccountHeadDashboardSummary,
    AccountRagRow,
    ActionRow,
    AssessmentRow,
    AssumptionRow,
    CommitmentRow,
    DashboardSummary,
    DataIntegrityRow,
    DEAssessmentCompletionSummary,
    DEDashboardSummary,
    DependencyRow,
    FindingRow,
    GeoHeadDashboardSummary,
    IssueRow,
    MetricRow,
    MyDashboardSummary,
    OpenNcListResponse,
    OpportunityRow,
    PaymentMilestoneRow,
    PmoDashboardSummary,
    ProjectHealthCardSummary,
    ProjectHealthDashboardSummary,
    ProjectHealthPeriod,
    ProjectListRow,
    RagRow,
    RaidoSummary,
    ReportSubmissionDetailRow,
    RiskRow,
)
from app.schemas.enums import HealthRating, RoleCode
from app.services import dashboard as dashboard_service
from app.services.dashboard import DashboardFilters

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _filters(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    health_status: HealthRating | None = Query(default=None),
    geo_ids: list[UUID] | None = Query(default=None),
    account_ids: list[UUID] | None = Query(default=None),
) -> DashboardFilters:
    return DashboardFilters(
        geo_id=geo_id,
        account_id=account_id,
        project_type_id=project_type_id,
        health_status=health_status,
        geo_ids=geo_ids,
        account_ids=account_ids,
    )


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    filters: DashboardFilters = Depends(_filters),
    db: AsyncSession = Depends(get_db),
):
    return DashboardSummary(
        active_projects=await dashboard_service.count_active_projects(db, filters),
        projects_by_type=await dashboard_service.projects_by_type(db, filters),
        delayed_projects=await dashboard_service.count_delayed_projects(db, filters),
        open_risks=await dashboard_service.count_open_risks(db, filters),
        open_issues=await dashboard_service.count_open_issues(db, filters),
        pending_approvals=await dashboard_service.count_pending_approvals(db, filters),
        project_health=await dashboard_service.project_health_rows(db, filters),
        account_health=await dashboard_service.account_health_rows(db, filters),
        contractual_compliance=await dashboard_service.contractual_compliance_summary(db, filters),
        milestone_payments=await dashboard_service.milestone_payment_summary(db, filters),
        account_matrix=await dashboard_service.account_health_matrix(db, filters),
        project_matrix=await dashboard_service.project_health_matrix(db, filters),
        account_highlights=await dashboard_service.account_highlights(db, filters),
        project_highlights=await dashboard_service.project_highlights(db, filters),
        open_ncs_count=await dashboard_service.count_open_ncs(db, filters),
        open_ncs=await dashboard_service.list_open_ncs(db, filters),
    )


# Standalone "Open Alerts" section for a single project / account / geo — used
# by the per-entity Project / Account / Geo dashboards (reporting hub) and the
# matching Review screens. `scope=account|geo` rolls up every project under
# that account/geo, mirroring how the summary endpoints already scope.
@router.get("/open-ncs", response_model=OpenNcListResponse)
async def get_open_ncs(
    scope: Literal["project", "account", "geo"] = Query(...),
    scope_id: UUID = Query(...),
    # "Open Alerts till the reporting period" — a reporting-hub caller that
    # hasn't saved a report for the period yet (so has no frozen snapshot to
    # show instead — see project_status.py/regional_status.py) passes the
    # period's end_date here to preview what a save right now would capture.
    # Omitted, every currently open Alert is returned (the plain live view).
    as_of: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if scope == "project":
        filters = DashboardFilters(project_id=scope_id)
    elif scope == "account":
        filters = DashboardFilters(account_id=scope_id)
    else:
        filters = DashboardFilters(geo_id=scope_id)
    return OpenNcListResponse(
        open_ncs_count=await dashboard_service.count_open_ncs(db, filters, as_of=as_of),
        open_ncs=await dashboard_service.list_open_ncs(db, filters, as_of=as_of),
    )


# Project Manager "My Summary" (design-reference/pm-mysummary.jpg). Also the
# landing page when an Account/Geo Head switches the top-bar Work Context to PM —
# in that case scope is derived from THEIR owned accounts/geos (never a query
# param), so one caller can't request another's scope.
@router.get(
    "/my-summary",
    response_model=MyDashboardSummary,
    dependencies=[
        Depends(
            require_role(
                RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN
            )
        )
    ],
)
async def get_my_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = await _role_code(db, current_user)
    if role == RoleCode.ACCOUNT_MANAGER:
        account_ids = (
            (await db.execute(select(UserAccount.account_id).where(UserAccount.user_id == current_user.id)))
            .scalars()
            .all()
        )
        filters = DashboardFilters(account_ids=list(account_ids))
    elif role == RoleCode.GEO_HEAD:
        geo_ids = (
            (await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == current_user.id)))
            .scalars()
            .all()
        )
        filters = DashboardFilters(geo_ids=list(geo_ids))
    elif role == RoleCode.ADMIN:
        filters = DashboardFilters()
    else:  # PROJECT_MANAGER
        filters = DashboardFilters(project_manager_id=current_user.id)

    projects = await dashboard_service.project_health_rows(db, filters)
    project_matrix = await dashboard_service.project_health_matrix(db, filters)
    report_status = await dashboard_service.project_report_status(db, filters, projects)
    attention_items, projects_requiring_attention = await dashboard_service.attention_required(db, filters, projects)
    reports_due = await dashboard_service.reports_due_summary(db, filters, projects)
    open_actions = await dashboard_service.my_open_actions(db, filters, projects, current_user.id)

    green, amber, potential_red, red = dashboard_service.health_split(project_matrix)
    not_assessed = dashboard_service.health_not_assessed(project_matrix)
    actions_high, actions_medium, actions_low = dashboard_service.open_action_priority_split(open_actions)

    return MyDashboardSummary(
        my_projects_count=len(projects),
        projects_requiring_attention=projects_requiring_attention,
        health_green=green,
        health_amber=amber,
        health_potential_red=potential_red,
        health_red=red,
        health_not_assessed=not_assessed,
        reports_due=reports_due,
        open_actions_count=len(open_actions),
        open_actions_overdue_count=sum(1 for a in open_actions if a.overdue),
        open_actions_high=actions_high,
        open_actions_medium=actions_medium,
        open_actions_low=actions_low,
        open_findings_count=await dashboard_service.count_open_findings(db, filters),
        open_ncs_count=await dashboard_service.count_open_ncs(db, filters),
        attention_items=attention_items,
        raido=RaidoSummary(
            open_risks=await dashboard_service.count_open_risks(db, filters),
            high_critical_risks=await dashboard_service.count_high_critical_risks(db, filters),
            open_issues=await dashboard_service.count_open_issues(db, filters),
            dependencies=await dashboard_service.count_open_dependencies(db, filters),
        ),
        project_health=dashboard_service.to_my_project_health_rows(project_matrix, report_status),
        open_actions=open_actions,
        open_ncs=await dashboard_service.list_open_ncs(db, filters),
    )


# Account Head "My Summary" (design-reference/acchead-mysummary.jpg) —
# account_ids comes from the session's owned accounts (user_accounts), not a
# query param. Also the landing page when a Geo Head switches the top-bar Work
# Context to Account Head — then account_ids is expanded from their owned geos.
@router.get(
    "/account-head-summary",
    response_model=AccountHeadDashboardSummary,
    dependencies=[Depends(require_role(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))],
)
async def get_account_head_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = await _role_code(db, current_user)
    if role == RoleCode.GEO_HEAD:
        geo_ids = (
            (await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == current_user.id)))
            .scalars()
            .all()
        )
        account_ids = (
            (await db.execute(select(Account.id).where(Account.geo_id.in_(geo_ids)))).scalars().all()
        )
    elif role == RoleCode.ADMIN:
        account_ids = (await db.execute(select(Account.id))).scalars().all()
    else:  # ACCOUNT_MANAGER
        account_ids = (
            (await db.execute(select(UserAccount.account_id).where(UserAccount.user_id == current_user.id)))
            .scalars()
            .all()
        )
    filters = DashboardFilters(account_ids=list(account_ids))

    accounts = await dashboard_service.account_health_rows(db, filters)
    projects = await dashboard_service.project_health_rows(db, filters)
    project_matrix = await dashboard_service.project_health_matrix(db, filters)
    account_matrix = await dashboard_service.account_health_matrix(db, filters)
    green, amber, potential_red, red = dashboard_service.health_split(project_matrix)

    queue, awaiting_review_count = await dashboard_service.report_review_queue(db, filters, projects)
    portfolio = dashboard_service.account_portfolio_health(project_matrix, account_matrix)
    readiness = await dashboard_service.reporting_readiness(db, filters, projects)
    attention_items = dashboard_service.account_head_attention_required(queue, portfolio)
    open_actions = await dashboard_service.account_head_open_actions(db, filters, projects, current_user.id)
    actions_high, actions_medium, actions_low = dashboard_service.open_action_priority_split(open_actions)

    return AccountHeadDashboardSummary(
        accounts_count=len(accounts),
        active_projects_count=await dashboard_service.count_active_projects(db, filters),
        health_green=green,
        health_amber=amber,
        health_potential_red=potential_red,
        health_red=red,
        awaiting_review_count=awaiting_review_count,
        high_critical_risks_count=await dashboard_service.count_high_critical_risks(db, filters),
        open_actions_high=actions_high,
        open_actions_medium=actions_medium,
        open_actions_low=actions_low,
        open_ncs_count=await dashboard_service.count_open_ncs(db, filters),
        report_review_queue=queue,
        account_portfolio_health=portfolio,
        attention_items=attention_items,
        reporting_readiness=readiness,
        open_actions=open_actions,
        open_ncs=await dashboard_service.list_open_ncs(db, filters),
    )


# Geo Head "My Summary" (design-reference/geohead-mysummary.jpg) — geo_ids
# come from the session's owned geos (user_geos), like account_ids does for
# get_account_head_dashboard_summary above; an optional `geo_id` query param
# narrows to a single owned geo for the page's geo selector, rejected with
# 403 if it isn't one of the caller's own.
@router.get(
    "/geo-head-summary",
    response_model=GeoHeadDashboardSummary,
    dependencies=[Depends(require_role(RoleCode.GEO_HEAD, RoleCode.ADMIN))],
)
async def get_geo_head_dashboard_summary(
    geo_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owned_geo_ids = (
        (await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == current_user.id))).scalars().all()
    )
    if geo_id is not None:
        if geo_id not in owned_geo_ids:
            raise HTTPException(status_code=403, detail="You do not have access to this geo.")
        geo_ids = [geo_id]
    else:
        geo_ids = list(owned_geo_ids)

    filters = DashboardFilters(geo_ids=geo_ids)

    accounts = await dashboard_service.account_health_rows(db, filters)
    account_ids = [a.account_id for a in accounts]
    projects = await dashboard_service.project_health_rows(db, filters)
    project_matrix = await dashboard_service.project_health_matrix(db, filters)
    account_matrix = await dashboard_service.account_health_matrix(db, filters)

    portfolio = dashboard_service.account_portfolio_health(project_matrix, account_matrix)
    readiness = await dashboard_service.reporting_readiness(db, filters, projects)
    queue, awaiting_review_count = await dashboard_service.account_review_queue(db, account_ids, account_matrix)
    high_critical_risks_count = await dashboard_service.count_high_critical_risks(db, filters)
    critical_attention = dashboard_service.geo_critical_attention(queue, portfolio, high_critical_risks_count)
    open_actions = await dashboard_service.geo_head_open_actions(
        db, projects, account_ids, geo_ids, current_user.id
    )

    return GeoHeadDashboardSummary(
        accounts_count=len(accounts),
        projects_count=await dashboard_service.count_active_projects(db, filters),
        geo_health=await dashboard_service.geo_health_rating(db, geo_ids),
        awaiting_review_count=awaiting_review_count,
        geo_report_due=await dashboard_service.geo_report_due(db, geo_ids),
        open_actions_count=len(open_actions),
        account_review_queue=queue,
        account_portfolio_health=portfolio,
        critical_attention=critical_attention,
        reporting_readiness=readiness,
        executive_update=await dashboard_service.geo_executive_update_summary(db, geo_ids),
        open_actions=open_actions,
    )


# Delivery Excellence dashboard (design-reference/de-mysummary.jpg). DE data is
# shared across every DE — this is NOT scoped to the signed-in DE's own
# allocations, only to projects that have been allocated to Delivery Excellence
# (de_allocated). A DE assessment is independent of PM reporting and of
# weekly/monthly reporting periods: everything below is measured against the
# current calendar month (a project must be assessed at least once per month,
# and may be assessed any number of times).
@router.get(
    "/de-summary",
    response_model=DEDashboardSummary,
    dependencies=[Depends(require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN))],
)
async def get_de_dashboard_summary(
    db: AsyncSession = Depends(get_db),
):
    filters = DashboardFilters(de_allocated=True)
    month = dashboard_service.current_month_window()

    work_queue = await dashboard_service.de_assessment_work_queue(db, filters, month)
    findings_by_project = await dashboard_service.de_findings_by_project(db, filters)
    recent_assessments_by_project = await dashboard_service.de_recent_assessments(db, filters, month)

    findings = dashboard_service.de_findings_summary(findings_by_project, month)
    attention_items = dashboard_service.de_attention_required(work_queue, findings_by_project, recent_assessments_by_project)

    completed_count = sum(1 for r in work_queue if r.status == "Assessed")
    total_count = len(work_queue)
    pending_count = sum(1 for r in work_queue if r.status != "Assessed")
    red_amber_count = sum(
        1 for r in work_queue if r.de_health in (HealthRating.AMBER, HealthRating.RED, HealthRating.POTENTIAL_RED)
    )
    pci_values = [float(r.pci_score) for r in work_queue if r.status == "Assessed" and r.pci_score is not None]
    average_pci = round(sum(pci_values) / len(pci_values), 1) if pci_values else None

    return DEDashboardSummary(
        period_id=None,
        period_label=month.label,
        assessments_due_count=total_count - completed_count,
        pending_count=pending_count,
        average_pci=average_pci,
        completion=DEAssessmentCompletionSummary(completed_count=completed_count, total_count=total_count),
        red_amber_assessed_count=red_amber_count,
        findings=findings,
        work_queue=work_queue,
        attention_items=attention_items,
    )


# PMO "My Summary" (design-reference/pmo-mysummary.jpg) — org-wide, unlike
# every summary above: no owned geo/account/project_manager_id to scope by,
# since a PMO user oversees the whole portfolio. No PMO login exists yet, so
# this is wired the same require_role way as the others, ready for when it
# does.
@router.get(
    "/pmo-summary",
    response_model=PmoDashboardSummary,
    dependencies=[Depends(require_role(RoleCode.PMO, RoleCode.ADMIN))],
)
async def get_pmo_dashboard_summary(db: AsyncSession = Depends(get_db)):
    filters = DashboardFilters()
    projects = await dashboard_service.project_health_rows(db, filters)
    project_ids = [p.project_id for p in projects]

    matrix, reporting_buckets, raido_stale = await dashboard_service.pmo_governance_compliance_matrix(db, filters)
    reporting_compliance = dashboard_service.pmo_reporting_compliance_summary(reporting_buckets)
    exceptions = await dashboard_service.pmo_governance_exceptions(db, matrix, reporting_buckets, raido_stale)
    reports_due = await dashboard_service.reports_due_summary(db, filters, projects)

    compliant_count = sum(1 for row in matrix if row.overall_status == "Compliant")
    governance_compliance_pct = round((compliant_count / len(matrix)) * 100) if matrix else 0

    return PmoDashboardSummary(
        active_projects_count=await dashboard_service.count_active_projects(db, filters),
        governance_compliance_pct=governance_compliance_pct,
        reports_overdue_count=reports_due.overdue_count,
        assessments_overdue_count=await dashboard_service.count_assessments_overdue(db, project_ids),
        high_critical_risks_count=await dashboard_service.count_high_critical_risks(db, filters),
        overdue_actions_count=await dashboard_service.count_overdue_actions(db),
        reporting_compliance=reporting_compliance,
        governance_exceptions=exceptions,
        governance_compliance=matrix,
    )


async def _health_scope(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Project Health is open to every signed-in user; what they can see is
    scoped by role, as DashboardFilters kwargs (merged into the endpoint's
    filters): Geo Head -> owned geos, Account Manager -> owned accounts,
    Project Manager -> own projects, Team Member -> nothing. Admin / PMO / CDO /
    Delivery Excellence are org-wide. Explicitly asking for a geo/account
    outside one's ownership is a 403."""
    role = await _role_code(db, current_user)
    if role == RoleCode.GEO_HEAD:
        owned = list(
            (await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == current_user.id))).scalars().all()
        )
        if geo_id is not None and geo_id not in owned:
            raise HTTPException(status_code=403, detail="You do not have access to this geo.")
        return {"geo_ids": owned}
    if role == RoleCode.ACCOUNT_MANAGER:
        owned = list(
            (await db.execute(select(UserAccount.account_id).where(UserAccount.user_id == current_user.id)))
            .scalars()
            .all()
        )
        if account_id is not None and account_id not in owned:
            raise HTTPException(status_code=403, detail="You do not have access to this account.")
        return {"account_ids": owned}
    if role == RoleCode.PROJECT_MANAGER:
        return {"project_manager_id": current_user.id}
    if role == RoleCode.TEAM_MEMBER:
        return {"account_ids": []}
    return {}


def _health_filters(
    geo_id: UUID | None, account_id: UUID | None, project_type_id: UUID | None, **extra
) -> DashboardFilters:
    """Project Health scope: Geo/Account/Type filters, minus Draft / Pending
    Approval projects."""
    return DashboardFilters(
        geo_id=geo_id, account_id=account_id, project_type_id=project_type_id, approved_only=True, **extra
    )


async def _weekly_period_or_current(db: AsyncSession, period_id: UUID | None) -> ReportingPeriod | None:
    """The selected Weekly period, or the current week when none is selected."""
    if period_id is None:
        return await dashboard_service.current_weekly_period(db)
    period = await db.get(ReportingPeriod, period_id)
    if period is None:
        raise HTTPException(status_code=404, detail="Reporting period not found.")
    if period.period_type != "Weekly":
        raise HTTPException(status_code=400, detail="Project Health periods are Weekly only.")
    return period


# Project Health dashboard (design-reference/Project-Health.html) — a new,
# additional org-wide portfolio page for PMO/Admin/CDO/Delivery Excellence
# (not a replacement of their existing landing summaries above), with a real
# Geo/Account/Project Type/Period filter bar unlike pmo-summary's fully
# unfiltered scope.
@router.get(
    "/project-health",
    response_model=ProjectHealthDashboardSummary,
)
async def get_project_health_dashboard(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    period_id: UUID | None = Query(default=None),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    # Portfolio + RAIDO-adjacent cards use every approved project; the bucketed
    # cards (health / metrics / commitments / DE / submissions) use Active only,
    # so each of their bucket sets sums to the Active Projects count.
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    active_filters = replace(filters, active_only=True)
    projects = await dashboard_service.project_health_rows(db, filters)
    project_ids = [p.project_id for p in projects]
    active_projects = await dashboard_service.project_health_rows(db, active_filters)
    active_project_ids = [p.project_id for p in active_projects]
    active_account_ids = await dashboard_service.active_account_ids(db, active_filters)

    week = await _weekly_period_or_current(db, period_id)
    month = dashboard_service.previous_month_window(week)
    month_period = await dashboard_service.monthly_period_for(db, month)

    return ProjectHealthDashboardSummary(
        portfolio=await dashboard_service.project_portfolio_summary(db, filters),
        health=await dashboard_service.project_health_week_summary(db, active_project_ids, week),
        account_health=await dashboard_service.account_health_week_summary(db, active_account_ids, week),
        risks=await dashboard_service.risk_card_summary(db, active_filters),
        issues=await dashboard_service.issue_card_summary(db, active_filters),
        dependencies=await dashboard_service.dependency_card_summary(db, active_filters),
        assumptions=await dashboard_service.assumption_card_summary(db, active_filters),
        opportunities=await dashboard_service.opportunity_card_summary(db, active_filters),
        metrics=await dashboard_service.project_metrics_bucket_summary(db, active_project_ids, month_period),
        commitments=await dashboard_service.commitments_bucket_summary(db, active_project_ids, month),
        payment_milestones=await dashboard_service.payment_milestones_card_summary(db, filters),
        actions=await dashboard_service.actions_card_summary(db, filters, project_ids),
        findings=await dashboard_service.findings_card_summary(db, filters),
        de_assessments=await dashboard_service.de_assessments_card_summary(db, active_project_ids, month),
        report_submissions=await dashboard_service.report_submissions_week_summary(
            db, active_filters, active_project_ids, week, month_period
        ),
        period_id=week.id if week else None,
        period_label=week.label if week else None,
    )


# Period combo source: Weekly periods only, the last 10 including the current
# one, newest (= current) first.
@router.get(
    "/project-health/periods",
    response_model=list[ProjectHealthPeriod],
)
async def get_project_health_periods(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    periods = await dashboard_service.recent_weekly_periods(db)
    return [
        ProjectHealthPeriod(
            id=p.id, label=p.label, start_date=p.start_date, end_date=p.end_date, is_current=(i == 0)
        )
        for i, p in enumerate(periods)
    ]


# Project Health drill-down list screens (design-reference/project-health-screens.md)
# — the grid data behind 4 of the dashboard's 12 report cards. Same role gate
# and Geo/Account/Project Type filters as /project-health above, plus paging.
@router.get("/project-health/projects", response_model=Page[ProjectListRow])
async def get_project_health_project_list(
    geo_id: UUID | None = Query(default=None),
    region_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    project_owned: str | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = DashboardFilters(
        geo_id=geo_id,
        region_id=region_id,
        account_id=account_id,
        project_type_id=project_type_id,
        project_owned=project_owned,
        approved_only=True,
        **scope,
    )
    items, total = await dashboard_service.list_projects_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/rag", response_model=Page[RagRow])
async def get_project_health_rag(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    period_id: UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, active_only=True, **scope)
    week = await _weekly_period_or_current(db, period_id)
    rows = await dashboard_service.list_rag_rows(db, filters, period_id=week.id if week else None)
    page = rows[pagination.skip : pagination.skip + pagination.limit]
    return Page(items=page, total=len(rows), skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/account-rag", response_model=Page[AccountRagRow])
async def get_project_health_account_rag(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    period_id: UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, active_only=True, **scope)
    week = await _weekly_period_or_current(db, period_id)
    rows = await dashboard_service.list_account_rag_rows(db, filters, period_id=week.id if week else None)
    page = rows[pagination.skip : pagination.skip + pagination.limit]
    return Page(items=page, total=len(rows), skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/risks", response_model=Page[RiskRow])
async def get_project_health_risks(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_risks_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/issues", response_model=Page[IssueRow])
async def get_project_health_issues(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_issues_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/dependencies", response_model=Page[DependencyRow])
async def get_project_health_dependencies(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_dependencies_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/assumptions", response_model=Page[AssumptionRow])
async def get_project_health_assumptions(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_assumptions_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/opportunities", response_model=Page[OpportunityRow])
async def get_project_health_opportunities(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_opportunities_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/metrics", response_model=Page[MetricRow])
async def get_project_health_metrics(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    period_id: UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, active_only=True, **scope)
    projects = await dashboard_service.project_health_rows(db, filters)
    project_ids = [p.project_id for p in projects]

    # Project Performance is monthly: read the month before the selected week.
    week = await _weekly_period_or_current(db, period_id)
    period = await dashboard_service.monthly_period_for(db, dashboard_service.previous_month_window(week))

    rows = await dashboard_service.list_metrics_for_health(db, filters, project_ids, period)
    page = rows[pagination.skip : pagination.skip + pagination.limit]
    return Page(items=page, total=len(rows), skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/commitments", response_model=Page[CommitmentRow])
async def get_project_health_commitments(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_commitments_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get(
    "/project-health/payment-milestones", response_model=Page[PaymentMilestoneRow]
)
async def get_project_health_payment_milestones(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_payment_milestones_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/assessments", response_model=Page[AssessmentRow])
async def get_project_health_assessments(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_assessments_for_health(
        db, filters, skip=pagination.skip, limit=pagination.limit
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/findings", response_model=Page[FindingRow])
async def get_project_health_findings(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    classification: str | None = Query(default=None),
    overdue: bool | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    items, total = await dashboard_service.list_findings_for_health(
        db,
        filters,
        skip=pagination.skip,
        limit=pagination.limit,
        classification=classification,
        overdue=overdue,
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/actions", response_model=Page[ActionRow])
async def get_project_health_actions(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    projects = await dashboard_service.project_health_rows(db, filters)
    project_ids = [p.project_id for p in projects]
    items, total = await dashboard_service.list_actions_for_health(
        db, filters, project_ids, skip=pagination.skip, limit=pagination.limit, search=search
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/project-health/data-integrity", response_model=Page[DataIntegrityRow])
async def get_project_health_data_integrity(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    projects = await dashboard_service.project_health_rows(db, filters)
    project_ids = [p.project_id for p in projects]
    items, total = await dashboard_service.list_data_integrity_for_health(
        db, filters, project_ids, skip=pagination.skip, limit=pagination.limit
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get(
    "/project-health/report-submissions",
    response_model=Page[ReportSubmissionDetailRow],
)
async def get_project_health_report_submissions(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    # KPI-scoped sub screens (frontend REPORT_SUBMISSION_STREAMS) narrow to one
    # stream and, by default, to the "who hasn't filed" rows: report_type is one
    # of the four ReportSubmissionDetailRow.report_type strings; pending=True
    # keeps only Not Submitted, pending=False only Submitted, unset keeps both.
    report_type: str | None = Query(default=None),
    pending: bool | None = Query(default=None),
    pagination: PaginationParams = Depends(pagination_params),
    scope: dict = Depends(_health_scope),
    db: AsyncSession = Depends(get_db),
):
    filters = _health_filters(geo_id, account_id, project_type_id, **scope)
    projects = await dashboard_service.project_health_rows(db, filters)
    items, total = await dashboard_service.list_report_submissions_for_health(
        db,
        filters,
        projects,
        skip=pagination.skip,
        limit=pagination.limit,
        report_type=report_type,
        pending=pending,
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)
