"""Portfolio-wide DE Findings — a cross-project read over the project-level
`de_assessment_findings` register (the project-scoped create/update stays in
`api/v1/endpoints/de_assessment.py`). Same "narrow query + Python reduction"
style as `services/dashboard.py`, whose finding helpers this reuses.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.de_assessment import de_assessment_finding_crud
from app.models.de_assessment import DEAssessmentFinding
from app.models.projects import Project
from app.models.reference_data import Account, Geo, Region
from app.models.users import User
from app.schemas.de_assessment import DEAssessmentFindingIn
from app.schemas.de_findings import DEFindingListRow, DEFindingsKpis
from app.schemas.enums import FindingStatus
from app.services.dashboard import MonthWindow, _FINDING_OPEN_STATES, current_month_window

_OPEN_VALUES = [s.value for s in _FINDING_OPEN_STATES]
_CLOSED_VALUES = [FindingStatus.CLOSED.value, FindingStatus.CANCELLED.value]
_HIGH_SEVERITIES = ["High", "Critical"]
_ATTENTION_OVERDUE_DAYS = 30
_PROJECT_OPEN_THRESHOLD = 5


@dataclass
class DEFindingFilters:
    geo_id: UUID | None = None
    account_id: UUID | None = None
    project_id: UUID | None = None
    # Set server-side (never a query param) to scope the list to one PM's
    # projects — used by the PM Findings screen, not the portfolio DE screen.
    project_manager_id: UUID | None = None
    classification: str | None = None
    severity: str | None = None
    # A concrete FindingStatus value, the sentinel "Active" (= not Closed /
    # Cancelled), or None for all.
    status: str | None = None
    search: str | None = None
    bucket: str | None = None


def _base_query():
    return (
        select(
            DEAssessmentFinding,
            Project.project_code,
            Project.project_name,
            Geo.name,
            Region.name,
            Account.name,
            User.full_name,
        )
        .outerjoin(Project, Project.id == DEAssessmentFinding.project_id)
        .outerjoin(Geo, Geo.id == Project.geo_id)
        .outerjoin(Region, Region.id == Project.region_id)
        .outerjoin(Account, Account.id == Project.account_id)
        .outerjoin(User, User.id == DEAssessmentFinding.assigned_to)
    )


def _conditions(filters: DEFindingFilters) -> list:
    today = date.today()
    conditions: list = []

    if filters.geo_id is not None:
        conditions.append(Project.geo_id == filters.geo_id)
    if filters.account_id is not None:
        conditions.append(Project.account_id == filters.account_id)
    if filters.project_id is not None:
        conditions.append(DEAssessmentFinding.project_id == filters.project_id)
    if filters.project_manager_id is not None:
        conditions.append(Project.project_manager_id == filters.project_manager_id)
    if filters.classification:
        conditions.append(DEAssessmentFinding.classification == filters.classification)
    if filters.severity:
        conditions.append(DEAssessmentFinding.severity == filters.severity)

    if filters.status == "Active":
        conditions.append(DEAssessmentFinding.status.notin_(_CLOSED_VALUES))
    elif filters.status:
        conditions.append(DEAssessmentFinding.status == filters.status)

    if filters.search:
        like = f"%{filters.search.strip()}%"
        conditions.append(
            or_(
                DEAssessmentFinding.description.ilike(like),
                Project.project_name.ilike(like),
                Project.project_code.ilike(like),
            )
        )

    bucket = filters.bucket
    if bucket == "overdue":
        conditions += [
            DEAssessmentFinding.due_date.is_not(None),
            DEAssessmentFinding.due_date < today,
            DEAssessmentFinding.status.notin_(_CLOSED_VALUES),
        ]
    elif bucket == "overdue_30d":
        conditions += [
            DEAssessmentFinding.due_date.is_not(None),
            DEAssessmentFinding.due_date < today - timedelta(days=_ATTENTION_OVERDUE_DAYS),
            DEAssessmentFinding.status.notin_(_CLOSED_VALUES),
        ]
    elif bucket == "high_critical":
        conditions += [
            DEAssessmentFinding.status.in_(_OPEN_VALUES),
            DEAssessmentFinding.severity.in_(_HIGH_SEVERITIES),
        ]
    elif bucket == "critical_open":
        conditions += [
            DEAssessmentFinding.status.in_(_OPEN_VALUES),
            DEAssessmentFinding.severity == "Critical",
        ]
    elif bucket == "awaiting_closure":
        conditions.append(DEAssessmentFinding.status == FindingStatus.AWAITING_CLOSURE.value)
    elif bucket == "closed_this_period":
        window = current_month_window()
        conditions += [
            DEAssessmentFinding.status == FindingStatus.CLOSED.value,
            DEAssessmentFinding.updated_at >= datetime.combine(window.start_date, time.min),
            DEAssessmentFinding.updated_at <= datetime.combine(window.end_date, time.max),
        ]
    elif bucket == "projects_over_5_open":
        over5 = (
            select(DEAssessmentFinding.project_id)
            .where(DEAssessmentFinding.status.in_(_OPEN_VALUES))
            .group_by(DEAssessmentFinding.project_id)
            .having(func.count(DEAssessmentFinding.id) > _PROJECT_OPEN_THRESHOLD)
            .scalar_subquery()
        )
        conditions.append(DEAssessmentFinding.project_id.in_(over5))

    return conditions


async def list_de_findings(
    db: AsyncSession, filters: DEFindingFilters, skip: int, limit: int
) -> tuple[list[DEFindingListRow], int]:
    conditions = _conditions(filters)

    count_stmt = (
        select(func.count())
        .select_from(DEAssessmentFinding)
        .outerjoin(Project, Project.id == DEAssessmentFinding.project_id)
    )
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = _base_query()
    if conditions:
        stmt = stmt.where(*conditions)
    stmt = stmt.order_by(
        DEAssessmentFinding.finding_date.is_(None),
        DEAssessmentFinding.finding_date.desc(),
        DEAssessmentFinding.sequence_no.desc(),
    ).offset(skip).limit(limit)
    rows = (await db.execute(stmt)).all()

    today = date.today()
    items: list[DEFindingListRow] = []
    for finding, p_code, p_name, geo_name, region_name, account_name, assignee_name in rows:
        items.append(
            DEFindingListRow(
                id=finding.id,
                project_id=finding.project_id,
                sequence_no=finding.sequence_no,
                classification=finding.classification,
                description=finding.description,
                severity=finding.severity,
                assigned_to=finding.assigned_to,
                action_taken=finding.action_taken,
                finding_date=finding.finding_date,
                due_date=finding.due_date,
                status=finding.status,
                remarks=finding.remarks,
                created_at=finding.created_at,
                updated_at=finding.updated_at,
                project_label=f"{p_code} · {p_name}" if p_code else str(finding.project_id),
                project_code=p_code,
                project_name=p_name,
                account_name=account_name,
                geo_name=geo_name,
                region_name=region_name,
                assignee_name=assignee_name,
                age_days=(today - finding.finding_date).days if finding.finding_date else None,
                overdue=(
                    finding.due_date is not None
                    and finding.due_date < today
                    and finding.status not in _CLOSED_VALUES
                ),
            )
        )
    return items, total


def compute_kpis(findings: list, window: MonthWindow) -> DEFindingsKpis:
    """Pure reduction over a list of finding rows (ORM objects or SimpleNamespace)
    — unit-testable without a DB, like dashboard.de_findings_summary."""
    today = date.today()
    open_findings = [f for f in findings if f.status in _OPEN_VALUES]
    overdue = [
        f
        for f in findings
        if f.status not in _CLOSED_VALUES and f.due_date is not None and f.due_date < today
    ]
    awaiting = [f for f in findings if f.status == FindingStatus.AWAITING_CLOSURE.value]
    closed_this_period = [
        f
        for f in findings
        if f.status == FindingStatus.CLOSED.value
        and window.start_date <= f.updated_at.date() <= window.end_date
    ]
    overdue_30d = [
        f for f in overdue if (today - f.due_date).days > _ATTENTION_OVERDUE_DAYS
    ]

    open_per_project: dict[UUID, int] = {}
    for f in open_findings:
        open_per_project[f.project_id] = open_per_project.get(f.project_id, 0) + 1

    return DEFindingsKpis(
        open_findings=len(open_findings),
        overdue=len(overdue),
        high_critical=len([f for f in open_findings if f.severity in _HIGH_SEVERITIES]),
        awaiting_closure=len(awaiting),
        closed_this_period=len(closed_this_period),
        overdue_30d_count=len(overdue_30d),
        critical_open_count=len([f for f in open_findings if f.severity == "Critical"]),
        awaiting_closure_count=len(awaiting),
        projects_over_5_open_count=sum(
            1 for n in open_per_project.values() if n > _PROJECT_OPEN_THRESHOLD
        ),
        period_label=window.label,
    )


async def de_findings_kpis(db: AsyncSession, filters: DEFindingFilters) -> DEFindingsKpis:
    """KPI tiles + attention counts over the Geo/Account/Project scope only —
    classification/severity/status/search/bucket do NOT narrow the numbers, so
    the tiles stay a stable overview while the grid reacts to everything."""
    scope: list = []
    if filters.geo_id is not None:
        scope.append(Project.geo_id == filters.geo_id)
    if filters.account_id is not None:
        scope.append(Project.account_id == filters.account_id)
    if filters.project_id is not None:
        scope.append(DEAssessmentFinding.project_id == filters.project_id)
    if filters.project_manager_id is not None:
        scope.append(Project.project_manager_id == filters.project_manager_id)

    stmt = select(DEAssessmentFinding).outerjoin(Project, Project.id == DEAssessmentFinding.project_id)
    if scope:
        stmt = stmt.where(*scope)
    findings = list((await db.execute(stmt)).scalars().all())
    return compute_kpis(findings, current_month_window())


async def create_project_finding(
    db: AsyncSession, project_id: UUID, payload: DEAssessmentFindingIn
) -> DEAssessmentFinding:
    """Create a finding under a project, assigning the next per-project
    sequence_no when the payload omits one. Lifted from de_assessment.add_finding
    so both the project-scoped and portfolio routes share it."""
    sequence_no = payload.sequence_no
    if sequence_no is None:
        current_max = (
            await db.execute(
                select(func.max(DEAssessmentFinding.sequence_no)).where(
                    DEAssessmentFinding.project_id == project_id
                )
            )
        ).scalar_one_or_none()
        sequence_no = (current_max or 0) + 1
    return await de_assessment_finding_crud.create(
        db, payload, project_id=project_id, sequence_no=sequence_no
    )
