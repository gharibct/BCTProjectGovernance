"""DE Account Audit helpers — the queue, finding list/KPIs and history writes for
the account-level audit (db/tables/59_de_account_audits.sql). Mirrors
services/de_findings.py (project level); the pure status-transition rules are
shared from there so the two registers can't drift.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.de_account_audit import DEAccountAudit, DEAccountFinding, DEAccountFindingHistory
from app.models.projects import Project
from app.models.reference_data import Account, Geo, Region
from app.models.users import User, UserAccount
from app.schemas.de_account_audit import (
    DEAccountFindingRow,
    DEAccountFindingsKpis,
    DEAccountQueue,
    DEAccountQueueRow,
)
from app.schemas.enums import DEAssessmentStatus, DEFindingHistoryEventType, FindingStatus
from app.services.dashboard import current_month_window

OPEN_VALUES = [FindingStatus.OPEN.value, FindingStatus.IN_PROGRESS.value]
CLOSED_VALUES = [FindingStatus.CLOSED.value, FindingStatus.CANCELLED.value]


# --- Audit queue ------------------------------------------------------------


async def account_heads(db: AsyncSession, account_ids: list[UUID]) -> dict[UUID, str]:
    """Primary (non-proxy) Delivery Manager name per account; oldest wins."""
    if not account_ids:
        return {}
    result = await db.execute(
        select(UserAccount.account_id, User.full_name)
        .join(User, User.id == UserAccount.user_id)
        .where(UserAccount.account_id.in_(account_ids), UserAccount.is_proxy.is_(False))
        .order_by(UserAccount.created_at)
    )
    heads: dict[UUID, str] = {}
    for account_id, name in result.all():
        heads.setdefault(account_id, name)
    return heads


async def build_queue(db: AsyncSession) -> DEAccountQueue:
    """One row per active account with a DE allocated. Status reflects this
    calendar month: Audited (>=1 Submitted audit), Draft (only a Draft) or Due."""
    window = current_month_window()
    de = aliased(User)
    rows = (
        await db.execute(
            select(Account, Geo.name, Region.name, de.full_name)
            .outerjoin(Geo, Geo.id == Account.geo_id)
            .outerjoin(Region, Region.id == Account.region_id)
            .outerjoin(de, de.id == Account.delivery_excellence_id)
            .where(Account.is_active.is_(True), Account.delivery_excellence_id.is_not(None))
            .order_by(Account.name)
        )
    ).all()
    ids = [a.id for a, *_ in rows]
    heads = await account_heads(db, ids)

    audits_by_account: dict[UUID, list[DEAccountAudit]] = {}
    open_counts: dict[UUID, int] = {}
    if ids:
        audits = (
            await db.execute(
                select(DEAccountAudit)
                .where(DEAccountAudit.account_id.in_(ids))
                .order_by(DEAccountAudit.audit_date.desc().nulls_last(), DEAccountAudit.created_at.desc())
            )
        ).scalars().all()
        for audit in audits:
            audits_by_account.setdefault(audit.account_id, []).append(audit)
        open_counts = {
            account_id: n
            for account_id, n in (
                await db.execute(
                    select(DEAccountFinding.account_id, func.count(DEAccountFinding.id))
                    .where(DEAccountFinding.account_id.in_(ids), DEAccountFinding.status.in_(OPEN_VALUES))
                    .group_by(DEAccountFinding.account_id)
                )
            ).all()
        }

    out: list[DEAccountQueueRow] = []
    for account, geo_name, region_name, de_name in rows:
        history = audits_by_account.get(account.id, [])
        this_month = [
            a for a in history if a.audit_date is not None and window.start_date <= a.audit_date <= window.end_date
        ]
        submitted = [a for a in history if a.status == DEAssessmentStatus.SUBMITTED.value]
        if any(a.status == DEAssessmentStatus.SUBMITTED.value for a in this_month):
            status = "Audited"
        elif any(a.status == DEAssessmentStatus.DRAFT.value for a in this_month):
            status = "Draft"
        else:
            status = "Due"
        latest = submitted[0] if submitted else None
        out.append(
            DEAccountQueueRow(
                account_id=account.id,
                account_name=account.name,
                geo_name=geo_name,
                region_name=region_name,
                critical_flag=account.critical_flag,
                account_head_name=heads.get(account.id),
                delivery_excellence_name=de_name,
                status=status,
                de_health=latest.de_assessed_health if latest else None,
                last_audit_date=latest.audit_date if latest else None,
                open_findings_count=open_counts.get(account.id, 0),
            )
        )
    return DEAccountQueue(
        period_label=window.label,
        total_count=len(out),
        audited_count=sum(1 for r in out if r.status == "Audited"),
        due_count=sum(1 for r in out if r.status != "Audited"),
        red_amber_count=sum(
            1 for r in out if r.status == "Audited" and r.de_health in ("Red", "Potential Red", "Amber")
        ),
        open_findings_count=sum(r.open_findings_count for r in out),
        rows=out,
    )


# --- Findings ---------------------------------------------------------------


@dataclass
class AccountFindingFilters:
    account_id: UUID | None = None
    geo_id: UUID | None = None
    # Set server-side (never a query param) to restrict to a Delivery Manager's accounts.
    restrict_account_ids: set[UUID] | None = None
    classification: str | None = None
    status: str | None = None  # a FindingStatus value, "Active" (default) or "All"
    search: str | None = None
    bucket: str | None = None  # overdue | awaiting_closure | closed_this_period


def _conditions(filters: AccountFindingFilters) -> list:
    today = date.today()
    cond: list = []
    if filters.account_id is not None:
        cond.append(DEAccountFinding.account_id == filters.account_id)
    if filters.geo_id is not None:
        cond.append(Account.geo_id == filters.geo_id)
    if filters.restrict_account_ids is not None:
        cond.append(DEAccountFinding.account_id.in_(filters.restrict_account_ids))
    if filters.classification:
        cond.append(DEAccountFinding.classification == filters.classification)
    status = (filters.status or "").strip()
    if not filters.bucket:  # a bucket owns the status dimension
        if status == "Active":
            cond.append(DEAccountFinding.status.notin_(CLOSED_VALUES))
        elif status and status != "All":
            cond.append(DEAccountFinding.status == status)
    if filters.search:
        like = f"%{filters.search.strip()}%"
        cond.append(or_(DEAccountFinding.description.ilike(like), Account.name.ilike(like)))
    if filters.bucket == "overdue":
        cond += [
            DEAccountFinding.due_date.is_not(None),
            DEAccountFinding.due_date < today,
            DEAccountFinding.status.notin_(CLOSED_VALUES),
        ]
    elif filters.bucket == "awaiting_closure":
        cond.append(DEAccountFinding.status == FindingStatus.AWAITING_CLOSURE.value)
    elif filters.bucket == "closed_this_period":
        window = current_month_window()
        cond += [
            DEAccountFinding.status == FindingStatus.CLOSED.value,
            DEAccountFinding.updated_at >= datetime.combine(window.start_date, time.min, tzinfo=UTC),
            DEAccountFinding.updated_at <= datetime.combine(window.end_date, time.max, tzinfo=UTC),
        ]
    return cond


def row_from(finding: DEAccountFinding, account_name, geo_name, region_name) -> DEAccountFindingRow:
    row = DEAccountFindingRow.model_validate(finding, from_attributes=True)
    row.account_name = account_name
    row.geo_name = geo_name
    row.region_name = region_name
    row.age_days = (date.today() - finding.finding_date).days if finding.finding_date else None
    return row


async def list_findings(
    db: AsyncSession, filters: AccountFindingFilters, skip: int, limit: int
) -> tuple[list[DEAccountFindingRow], int]:
    cond = _conditions(filters)
    stmt = (
        select(DEAccountFinding, Account.name, Geo.name, Region.name)
        .join(Account, Account.id == DEAccountFinding.account_id)
        .outerjoin(Geo, Geo.id == Account.geo_id)
        .outerjoin(Region, Region.id == Account.region_id)
    )
    count = select(func.count()).select_from(DEAccountFinding).join(Account, Account.id == DEAccountFinding.account_id)
    if cond:
        stmt = stmt.where(*cond)
        count = count.where(*cond)
    total = (await db.execute(count)).scalar_one()
    stmt = stmt.order_by(
        DEAccountFinding.finding_date.is_(None),
        DEAccountFinding.finding_date.desc(),
        DEAccountFinding.sequence_no.desc(),
    ).offset(skip).limit(limit)
    rows = (await db.execute(stmt)).all()
    out = [row_from(f, a, g, r) for f, a, g, r in rows]
    pids = {pid for row in out for pid in row.project_ids}
    if pids:
        codes = dict(
            (await db.execute(select(Project.id, Project.project_code).where(Project.id.in_(pids)))).all()
        )
        for row in out:
            row.project_codes = sorted(codes[pid] for pid in row.project_ids if pid in codes)
    return out, total


async def findings_kpis(db: AsyncSession, filters: AccountFindingFilters) -> DEAccountFindingsKpis:
    """Tiles over the account scope only — status/classification/search/bucket do not narrow them."""
    scope = AccountFindingFilters(account_id=filters.account_id, restrict_account_ids=filters.restrict_account_ids)
    cond = _conditions(scope)
    stmt = select(DEAccountFinding).join(Account, Account.id == DEAccountFinding.account_id)
    if cond:
        stmt = stmt.where(*cond)
    findings = list((await db.execute(stmt)).scalars().all())
    window = current_month_window()
    today = date.today()
    return DEAccountFindingsKpis(
        open_findings=sum(1 for f in findings if f.status in OPEN_VALUES),
        overdue=sum(
            1 for f in findings if f.status not in CLOSED_VALUES and f.due_date is not None and f.due_date < today
        ),
        awaiting_closure=sum(1 for f in findings if f.status == FindingStatus.AWAITING_CLOSURE.value),
        closed_this_period=sum(
            1
            for f in findings
            if f.status == FindingStatus.CLOSED.value and window.start_date <= f.updated_at.date() <= window.end_date
        ),
        period_label=window.label,
    )


async def next_sequence_no(db: AsyncSession, account_id: UUID) -> int:
    current = (
        await db.execute(
            select(func.max(DEAccountFinding.sequence_no)).where(DEAccountFinding.account_id == account_id)
        )
    ).scalar_one_or_none()
    return (current or 0) + 1


async def record_history(
    db: AsyncSession,
    finding_id: UUID,
    event_type: DEFindingHistoryEventType,
    user_id: UUID,
    *,
    old_value: str | None = None,
    new_value: str | None = None,
    comment: str | None = None,
) -> None:
    db.add(
        DEAccountFindingHistory(
            id=uuid4(),
            finding_id=finding_id,
            event_type=event_type.value,
            old_value=old_value,
            new_value=new_value,
            comment=comment,
            created_by=user_id,
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()


async def record_status_change(
    db: AsyncSession, finding_id: UUID, user_id: UUID, old_status: str | None, new_status: str | None
) -> None:
    """No-op unless the status actually changed."""
    if new_status is None or new_status == old_status:
        return
    await record_history(
        db, finding_id, DEFindingHistoryEventType.STATUS_CHANGE, user_id, old_value=old_status, new_value=new_status
    )


async def list_history(db: AsyncSession, finding_id: UUID) -> list[DEAccountFindingHistory]:
    return list(
        (
            await db.execute(
                select(DEAccountFindingHistory)
                .where(DEAccountFindingHistory.finding_id == finding_id)
                .order_by(DEAccountFindingHistory.created_at)
            )
        ).scalars().all()
    )
