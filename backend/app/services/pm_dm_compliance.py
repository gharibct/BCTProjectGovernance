"""PM / DM Compliance — per person, the weekly status reports they owed vs filed.

Source: design-reference/Governance-One-Adoption-Flash.xlsx. A person owes
  - the weekly project status report of every project they are the Primary or a
    proxy PM of, and
  - the weekly account status report of every account they are the Primary or a
    proxy Delivery Manager of.
The selected completed Weekly period and the three before it supply the columns
(a rolling 4-week score; reporting happens ON the end date).

"Owed", the restriction switch-off and the late rule are the shared ones used by
the Project Health report-submission cards (services/dashboard.py `_owed_pairs`,
`project_period_restriction`, services/report_timeliness.py `is_late`).
"""

from collections import defaultdict
from dataclasses import replace
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_status import ProjectStatusReport
from app.models.projects import Project, ProjectProxyManager
from app.models.reference_data import Account, ReportingPeriod
from app.models.regional_status import AccountStatusReport
from app.models.users import User, UserAccount
from app.schemas.dashboard import (
    PmDmComplianceCell,
    PmDmCompliancePeriod,
    PmDmComplianceResponse,
    PmDmComplianceRow,
    PmDmComplianceSummary,
    PmDmComplianceWeek,
)
from app.services.dashboard import (
    _SUBMITTED_REPORT_STATUSES,
    DashboardFilters,
    _account_conditions,
    _owed_pairs,
    _project_conditions,
    project_period_restriction,
)
from app.services.report_timeliness import is_late

PERIOD_COMBO_LIMIT = 12
ROLLING_WEEKS = 4


async def completed_weekly_periods(db: AsyncSession, today: date | None = None) -> list[ReportingPeriod]:
    """Active Weekly periods that have ended (end_date <= today), newest first —
    the period combo's options."""
    today = today or date.today()
    stmt = (
        select(ReportingPeriod)
        .where(
            ReportingPeriod.period_type == "Weekly",
            ReportingPeriod.is_active.is_(True),
            ReportingPeriod.end_date <= today,
        )
        .order_by(ReportingPeriod.end_date.desc())
        .limit(PERIOD_COMBO_LIMIT)
    )
    return list((await db.execute(stmt)).scalars().all())


async def _rolling_weeks(db: AsyncSession, selected: ReportingPeriod, today: date) -> list[ReportingPeriod]:
    """The selected week plus the three before it (oldest first)."""
    stmt = (
        select(ReportingPeriod)
        .where(
            ReportingPeriod.period_type == "Weekly",
            ReportingPeriod.is_active.is_(True),
            ReportingPeriod.end_date <= selected.end_date,
            ReportingPeriod.end_date <= today,
        )
        .order_by(ReportingPeriod.end_date.desc())
        .limit(ROLLING_WEEKS)
    )
    return sorted((await db.execute(stmt)).scalars().all(), key=lambda w: w.end_date)


def _pct(part: int, whole: int) -> int:
    return round(part / whole * 100) if whole else 0


async def pm_dm_compliance(
    db: AsyncSession, filters: DashboardFilters, selected: ReportingPeriod | None, today: date | None = None
) -> PmDmComplianceResponse:
    today = today or date.today()
    weeks = await _rolling_weeks(db, selected, today) if selected is not None else []
    period = (
        PmDmCompliancePeriod(
            id=selected.id, label=selected.label, start_date=selected.start_date, end_date=selected.end_date
        )
        if selected is not None
        else None
    )
    week_models = [PmDmComplianceWeek(period_id=w.id, label=w.label, end_date=w.end_date) for w in weeks]
    if not weeks:
        return PmDmComplianceResponse(
            period=period, weeks=week_models, rows=[], summary=_summary([])
        )

    week_ids = [w.id for w in weeks]
    # user_id -> period_id -> [expected, submitted, on_time]
    tally: dict[UUID, dict[UUID, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))

    def record(owners: list[UUID], period_obj: ReportingPeriod, report) -> None:
        for user_id in owners:
            cell = tally[user_id][period_obj.id]
            cell[0] += 1
            if report is not None:
                cell[1] += 1
                if not is_late(report, period_obj):
                    cell[2] += 1

    by_period = {w.id: w for w in weeks}

    # --- PMs: weekly project status reports of active, approved projects ---
    project_filters = replace(filters, approved_only=True, active_only=True)
    project_rows = (
        await db.execute(
            select(
                Project.id,
                Project.project_manager_id,
                func.coalesce(Project.tool_effective_date, Project.actual_start_date, Project.planned_start_date),
            ).where(*_project_conditions(project_filters))
        )
    ).all()
    if project_rows:
        project_ids = [r[0] for r in project_rows]
        start_by_project = {r[0]: r[2] for r in project_rows}
        owners_by_project: dict[UUID, list[UUID]] = {
            r[0]: [r[1]] if r[1] is not None else [] for r in project_rows
        }
        proxies = (
            await db.execute(
                select(ProjectProxyManager.project_id, ProjectProxyManager.user_id).where(
                    ProjectProxyManager.project_id.in_(project_ids)
                )
            )
        ).all()
        for project_id, user_id in proxies:
            if user_id not in owners_by_project[project_id]:
                owners_by_project[project_id].append(user_id)

        owed = _owed_pairs(
            project_ids, start_by_project, weeks, today, await project_period_restriction(db, project_ids, "delivery")
        )
        filed = {
            (r.project_id, r.period_id): r
            for r in (
                await db.execute(
                    select(ProjectStatusReport).where(
                        ProjectStatusReport.project_id.in_(project_ids),
                        ProjectStatusReport.period_id.in_(week_ids),
                        ProjectStatusReport.status.in_(_SUBMITTED_REPORT_STATUSES),
                    )
                )
            ).scalars()
        }
        for project_id, period_id in owed:
            record(owners_by_project[project_id], by_period[period_id], filed.get((project_id, period_id)))

    # --- DMs: weekly account status reports of in-scope accounts ---
    account_conditions = _account_conditions(filters)
    account_stmt = select(Account.id, Account.tool_effective_date)
    if account_conditions:
        account_stmt = account_stmt.where(*account_conditions)
    account_rows = (await db.execute(account_stmt)).all()
    if account_rows:
        account_ids = [r[0] for r in account_rows]
        start_by_account = {r[0]: r[1] for r in account_rows}
        owners_by_account: dict[UUID, list[UUID]] = defaultdict(list)
        for account_id, user_id in (
            await db.execute(
                select(UserAccount.account_id, UserAccount.user_id).where(UserAccount.account_id.in_(account_ids))
            )
        ).all():
            owners_by_account[account_id].append(user_id)

        owed_acc = _owed_pairs(account_ids, start_by_account, weeks, today)
        filed_acc = {
            (r.account_id, r.period_id): r
            for r in (
                await db.execute(
                    select(AccountStatusReport).where(
                        AccountStatusReport.account_id.in_(account_ids),
                        AccountStatusReport.period_id.in_(week_ids),
                        AccountStatusReport.status.in_(_SUBMITTED_REPORT_STATUSES),
                    )
                )
            ).scalars()
        }
        for account_id, period_id in owed_acc:
            record(owners_by_account.get(account_id, []), by_period[period_id], filed_acc.get((account_id, period_id)))

    names: dict[UUID, str] = {}
    if tally:
        names = dict(
            (await db.execute(select(User.id, User.full_name).where(User.id.in_(list(tally.keys()))))).all()
        )

    rows: list[PmDmComplianceRow] = []
    for user_id, per_week in tally.items():
        cells = []
        for week in weeks:
            expected, submitted, on_time = per_week.get(week.id, (0, 0, 0))
            cells.append(PmDmComplianceCell(expected=expected, submitted=submitted, on_time=on_time))
        owed_weeks = [c for c in cells if c.expected > 0]
        rows.append(
            PmDmComplianceRow(
                user_id=user_id,
                name=names.get(user_id, "Unknown"),
                weeks=cells,
                expected=sum(c.expected for c in cells),
                submitted=sum(c.submitted for c in cells),
                on_time=sum(c.on_time for c in cells),
                weeks_fully_submitted=sum(1 for c in owed_weeks if c.submitted >= c.expected),
                weeks_owed=len(owed_weeks),
            )
        )
    rows.sort(key=lambda r: r.name.lower())
    return PmDmComplianceResponse(period=period, weeks=week_models, rows=rows, summary=_summary(rows))


def _summary(rows: list[PmDmComplianceRow]) -> PmDmComplianceSummary:
    expected = sum(r.expected for r in rows)
    submitted = sum(r.submitted for r in rows)
    on_time = sum(r.on_time for r in rows)
    return PmDmComplianceSummary(
        people=len(rows),
        fully_compliant_people=sum(1 for r in rows if r.submitted >= r.expected),
        expected=expected,
        submitted=submitted,
        on_time=on_time,
        submitted_pct=_pct(submitted, expected),
        on_time_pct=_pct(on_time, expected),
    )
