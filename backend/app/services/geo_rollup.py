"""Account -> Geo rollup: pre-fills a Geo Weekly report's Key Metrics from
summing its accounts' own Weekly reports for the same period, and surfaces
those accounts' status items so a Geo Head can pull individual ones into
the geo's own register. Mirrors services/account_rollup.py one level up —
same reduction style (narrow queries, summing in Python).
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.regional_status import geo_status_item_crud
from app.models.reference_data import Account
from app.models.regional_status import AccountStatusItem, AccountStatusReport, GeoStatusItem
from app.schemas.enums import ReportStatus, RollupStatus
from app.schemas.geo_rollup import GeoRollupItem, GeoRollupMetrics, GeoRollupResponse
from app.schemas.regional_status import GeoStatusItemCreate
from app.services.account_rollup import RollupItemAlreadyHandledError, RollupItemNotFoundError

__all__ = ["RollupItemAlreadyHandledError", "RollupItemNotFoundError", "compute_geo_rollup", "pull_rollup_item"]


def _sum(values: list[Decimal | int | None]) -> Decimal | int | None:
    present = [v for v in values if v is not None]
    if not present:
        return None
    total = present[0]
    for v in present[1:]:
        total += v
    return total


async def compute_geo_rollup(db: AsyncSession, geo_id: UUID, period_id: UUID) -> GeoRollupResponse:
    accounts = (await db.execute(select(Account).where(Account.geo_id == geo_id))).scalars().all()
    if not accounts:
        return GeoRollupResponse(
            metrics=GeoRollupMetrics(
                revenue=None, onsite_fte=None, offshore_fte=None, projects_count=None, contributing_account_count=0
            ),
            items=[],
        )

    account_by_id = {a.id: a for a in accounts}
    reports = (
        await db.execute(
            select(AccountStatusReport).where(
                AccountStatusReport.account_id.in_(account_by_id.keys()),
                AccountStatusReport.period_id == period_id,
                AccountStatusReport.status != ReportStatus.DRAFT,
            )
        )
    ).scalars().all()

    metrics = GeoRollupMetrics(
        revenue=_sum([r.revenue for r in reports]),
        onsite_fte=_sum([r.onsite_fte for r in reports]),
        offshore_fte=_sum([r.offshore_fte for r in reports]),
        projects_count=_sum([r.projects_count for r in reports]),
        contributing_account_count=len(reports),
    )

    contributing_account_ids = [r.account_id for r in reports]
    status_items: list[AccountStatusItem] = []
    if contributing_account_ids:
        status_items = (
            (
                await db.execute(
                    select(AccountStatusItem).where(
                        AccountStatusItem.account_id.in_(contributing_account_ids),
                        AccountStatusItem.period_id == period_id,
                    )
                )
            )
            .scalars()
            .all()
        )

    items = [
        GeoRollupItem(
            id=item.id,
            account_id=item.account_id,
            account_name=account_by_id[item.account_id].name,
            category=item.category,
            description=item.description,
            account_rollup_status=item.account_rollup_status,
            rolled_up_geo_item_id=item.rolled_up_geo_item_id,
        )
        for item in status_items
    ]

    return GeoRollupResponse(metrics=metrics, items=items)


async def pull_rollup_item(db: AsyncSession, geo_id: UUID, account_item_id: UUID) -> GeoStatusItem:
    item = await db.get(AccountStatusItem, account_item_id)
    if item is None:
        raise RollupItemNotFoundError
    account = await db.get(Account, item.account_id)
    if account is None or account.geo_id != geo_id:
        raise RollupItemNotFoundError
    if item.account_rollup_status != RollupStatus.PENDING:
        raise RollupItemAlreadyHandledError

    geo_item = await geo_status_item_crud.create(
        db,
        GeoStatusItemCreate(
            period_id=item.period_id,
            category=item.category,
            description=f"{account.name} — {item.description}",
        ),
        geo_id=geo_id,
    )

    item.account_rollup_status = RollupStatus.PULLED
    item.rolled_up_geo_item_id = geo_item.id
    await db.flush()

    return geo_item
