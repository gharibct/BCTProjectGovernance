"""Project -> Account rollup: pre-fills an Account Weekly report's Key
Metrics from summing its projects' own Weekly reports for the same period,
and surfaces those projects' status items so an Account Manager can pull
individual ones into the account's own register (see plan: "Project ->
Account Rollup"). Mirrors services/dashboard.py's style — narrow queries,
grouping/summing done in Python since portfolio sizes here are small.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.regional_status import account_status_item_crud
from app.models.project_status import ProjectStatusItem, ProjectStatusReport
from app.models.projects import Project
from app.models.regional_status import AccountStatusItem
from app.schemas.account_rollup import AccountRollupItem, AccountRollupMetrics, AccountRollupResponse
from app.schemas.enums import ReportStatus, RollupStatus
from app.schemas.regional_status import AccountStatusItemCreate


def _sum(values: list[Decimal | int | None]) -> Decimal | int | None:
    present = [v for v in values if v is not None]
    if not present:
        return None
    total = present[0]
    for v in present[1:]:
        total += v
    return total


async def compute_account_rollup(db: AsyncSession, account_id: UUID, period_id: UUID) -> AccountRollupResponse:
    projects = (
        (await db.execute(select(Project).where(Project.account_id == account_id))).scalars().all()
    )
    if not projects:
        return AccountRollupResponse(
            metrics=AccountRollupMetrics(
                revenue=None, onsite_fte=None, offshore_fte=None, projects_count=None, contributing_project_count=0
            ),
            items=[],
        )

    project_by_id = {p.id: p for p in projects}
    reports = (
        await db.execute(
            select(ProjectStatusReport).where(
                ProjectStatusReport.project_id.in_(project_by_id.keys()),
                ProjectStatusReport.period_id == period_id,
                ProjectStatusReport.status != ReportStatus.DRAFT,
            )
        )
    ).scalars().all()

    metrics = AccountRollupMetrics(
        revenue=_sum([r.revenue for r in reports]),
        onsite_fte=_sum([r.onsite_fte for r in reports]),
        offshore_fte=_sum([r.offshore_fte for r in reports]),
        projects_count=_sum([r.projects_count for r in reports]),
        contributing_project_count=len(reports),
    )

    contributing_project_ids = [r.project_id for r in reports]
    status_items: list[ProjectStatusItem] = []
    if contributing_project_ids:
        status_items = (
            (
                await db.execute(
                    select(ProjectStatusItem).where(
                        ProjectStatusItem.project_id.in_(contributing_project_ids),
                        ProjectStatusItem.period_id == period_id,
                    )
                )
            )
            .scalars()
            .all()
        )

    items = [
        AccountRollupItem(
            id=item.id,
            project_id=item.project_id,
            project_code=project_by_id[item.project_id].project_code,
            project_name=project_by_id[item.project_id].project_name,
            category=item.category,
            description=item.description,
            account_rollup_status=item.account_rollup_status,
            rolled_up_account_item_id=item.rolled_up_account_item_id,
        )
        for item in status_items
    ]

    return AccountRollupResponse(metrics=metrics, items=items)


class RollupItemNotFoundError(Exception):
    pass


class RollupItemAlreadyHandledError(Exception):
    pass


async def pull_rollup_item(db: AsyncSession, account_id: UUID, project_item_id: UUID) -> AccountStatusItem:
    item = await db.get(ProjectStatusItem, project_item_id)
    if item is None:
        raise RollupItemNotFoundError
    project = await db.get(Project, item.project_id)
    if project is None or project.account_id != account_id:
        raise RollupItemNotFoundError
    if item.account_rollup_status != RollupStatus.PENDING:
        raise RollupItemAlreadyHandledError

    account_item = await account_status_item_crud.create(
        db,
        AccountStatusItemCreate(
            period_id=item.period_id,
            category=item.category,
            description=f"{project.project_code} — {item.description}",
        ),
        account_id=account_id,
    )

    item.account_rollup_status = RollupStatus.PULLED
    item.rolled_up_account_item_id = account_item.id
    await db.flush()

    return account_item
