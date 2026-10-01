"""Auto-generated Geo reports: Geo Heads don't have time to author a Delivery
Status Report from scratch, so a Geo report for a period is generated (status
"Auto Generated") as soon as one of the geo's accounts files (Submitted /
Approved) its own report for that period, and refreshed as the other accounts
file theirs — Key Metrics summed, and every account's Key Accomplishments /
Upcoming Releases / Key Risks & Issues / Leadership Support items pulled in.

Once the Geo Head touches the report it becomes "Draft - Saved" and this
sync leaves it alone (their edits must not be overwritten); likewise a
Baselined report. A Geo Head who drafts before any account has filed creates
the Draft - Saved report themselves.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference_data import Account
from app.models.regional_status import AccountStatusItem, AccountStatusReport, GeoStatusItem, GeoStatusReport
from app.schemas.enums import ReportStatus, RollupStatus
from app.services import dashboard as dashboard_service
from app.services.geo_rollup import _sum

_FILED = (ReportStatus.SUBMITTED, ReportStatus.APPROVED)


async def _geo_report(db: AsyncSession, geo_id: UUID, period_id: UUID) -> GeoStatusReport | None:
    return (
        await db.execute(
            select(GeoStatusReport).where(GeoStatusReport.geo_id == geo_id, GeoStatusReport.period_id == period_id)
        )
    ).scalars().first()


async def sync_geo_report_from_accounts(db: AsyncSession, geo_id: UUID, period_id: UUID) -> None:
    accounts = (await db.execute(select(Account).where(Account.geo_id == geo_id))).scalars().all()
    account_by_id = {a.id: a for a in accounts}
    if not account_by_id:
        return

    geo_report = await _geo_report(db, geo_id, period_id)
    if geo_report is not None and geo_report.status != ReportStatus.AUTO_GENERATED:
        return

    filed = (
        await db.execute(
            select(AccountStatusReport).where(
                AccountStatusReport.account_id.in_(account_by_id.keys()),
                AccountStatusReport.period_id == period_id,
                AccountStatusReport.status.in_(_FILED),
            )
        )
    ).scalars().all()

    if geo_report is None:
        if not filed:
            return
        now = datetime.now(UTC)
        geo_report = GeoStatusReport(
            id=uuid4(),
            geo_id=geo_id,
            period_id=period_id,
            status=ReportStatus.AUTO_GENERATED,
            created_at=now,
            updated_at=now,
        )
        db.add(geo_report)

    geo_report.revenue = _sum([r.revenue for r in filed])
    geo_report.onsite_fte = _sum([r.onsite_fte for r in filed])
    geo_report.offshore_fte = _sum([r.offshore_fte for r in filed])
    geo_report.projects_count = _sum([r.projects_count for r in filed])
    alerts_count, alerts_snapshot = await dashboard_service.open_alerts_snapshot(db, scope="geo", scope_id=geo_id)
    geo_report.open_alerts_count = alerts_count
    geo_report.open_alerts_snapshot = alerts_snapshot
    await db.flush()

    # Rebuild the geo's items for the period from scratch: release the account
    # items this report previously pulled, drop the geo rows, re-pull.
    account_items = (
        await db.execute(
            select(AccountStatusItem).where(
                AccountStatusItem.account_id.in_(account_by_id.keys()), AccountStatusItem.period_id == period_id
            )
        )
    ).scalars().all()
    for item in account_items:
        if item.account_rollup_status == RollupStatus.PULLED:
            item.account_rollup_status = RollupStatus.PENDING
            item.rolled_up_geo_item_id = None
    await db.execute(
        delete(GeoStatusItem).where(GeoStatusItem.geo_id == geo_id, GeoStatusItem.period_id == period_id)
    )

    filed_account_ids = {r.account_id for r in filed}
    for item in account_items:
        if item.account_id not in filed_account_ids or item.account_rollup_status != RollupStatus.PENDING:
            continue
        now = datetime.now(UTC)
        geo_item = GeoStatusItem(
            id=uuid4(),
            created_at=now,
            updated_at=now,
            geo_id=geo_id,
            period_id=period_id,
            category=item.category,
            description=f"{account_by_id[item.account_id].name} — {item.description}",
        )
        db.add(geo_item)
        await db.flush()
        item.account_rollup_status = RollupStatus.PULLED
        item.rolled_up_geo_item_id = geo_item.id
    await db.flush()


async def mark_geo_report_saved(db: AsyncSession, geo_id: UUID, period_id: UUID, *, create: bool = False) -> None:
    """The Geo Head saved something: an Auto Generated report becomes Draft -
    Saved (and stops being refreshed); with `create`, a missing report is
    created as Draft - Saved."""
    geo_report = await _geo_report(db, geo_id, period_id)
    if geo_report is None:
        if create:
            now = datetime.now(UTC)
            db.add(
                GeoStatusReport(
                    id=uuid4(),
                    geo_id=geo_id,
                    period_id=period_id,
                    status=ReportStatus.DRAFT_SAVED,
                    created_at=now,
                    updated_at=now,
                )
            )
            await db.flush()
    elif geo_report.status == ReportStatus.AUTO_GENERATED:
        geo_report.status = ReportStatus.DRAFT_SAVED
        await db.flush()
