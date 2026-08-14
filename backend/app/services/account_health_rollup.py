"""Project -> Account rollup for RAG Status notes: surfaces a project's own
health items so an Account Manager can pull individual ones into the
account's own register. Mirrors services/account_rollup.py, minus the Key
Metrics summing step — HealthDeclaration has no Draft/Submitted status and
no numeric fields to sum, so every ProjectHealthItem for the account's
projects at the given period is a candidate, with no report-status filter.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.account_health_declarations import account_health_item_crud
from app.models.health_declarations import ProjectHealthItem
from app.models.projects import Project
from app.schemas.account_health_declarations import AccountHealthItemCreate
from app.schemas.account_health_rollup import AccountHealthRollupItem, AccountHealthRollupResponse
from app.schemas.enums import RollupStatus
from app.services.account_rollup import RollupItemAlreadyHandledError, RollupItemNotFoundError


async def compute_account_health_rollup(
    db: AsyncSession, account_id: UUID, period_id: UUID
) -> AccountHealthRollupResponse:
    projects = (await db.execute(select(Project).where(Project.account_id == account_id))).scalars().all()
    if not projects:
        return AccountHealthRollupResponse(items=[])

    project_by_id = {p.id: p for p in projects}
    health_items = (
        (
            await db.execute(
                select(ProjectHealthItem).where(
                    ProjectHealthItem.project_id.in_(project_by_id.keys()),
                    ProjectHealthItem.period_id == period_id,
                )
            )
        )
        .scalars()
        .all()
    )

    items = [
        AccountHealthRollupItem(
            id=item.id,
            project_id=item.project_id,
            project_code=project_by_id[item.project_id].project_code,
            project_name=project_by_id[item.project_id].project_name,
            category=item.category,
            description=item.description,
            account_rollup_status=item.account_rollup_status,
            rolled_up_account_item_id=item.rolled_up_account_item_id,
        )
        for item in health_items
    ]

    return AccountHealthRollupResponse(items=items)


async def pull_health_rollup_item(db: AsyncSession, account_id: UUID, project_item_id: UUID):
    item = await db.get(ProjectHealthItem, project_item_id)
    if item is None:
        raise RollupItemNotFoundError
    project = await db.get(Project, item.project_id)
    if project is None or project.account_id != account_id:
        raise RollupItemNotFoundError
    if item.account_rollup_status != RollupStatus.PENDING:
        raise RollupItemAlreadyHandledError

    account_item = await account_health_item_crud.create(
        db,
        AccountHealthItemCreate(
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
