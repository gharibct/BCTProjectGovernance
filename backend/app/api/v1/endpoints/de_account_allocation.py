"""DE Account Allocation — a DE (or Admin) assigns a Delivery Excellence auditor
to an active account, and can reassign or clear it at any time (the list
endpoint's `allocation` filter surfaces already-allocated accounts for that).
Assignment writes Account.delivery_excellence_id + Account.de_allocated_at;
there is no separate allocation entity. Independent of the project-level DE
allocation (see de_allocation.py) — the two never affect each other.
"""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import get_current_user, require_role
from app.core.db import get_db
from app.models.projects import Project
from app.models.reference_data import Account, Geo, Region
from app.models.users import Role, User, UserAccount
from app.schemas.de_account_allocation import DeAccountAllocationBulkAssign, DeAccountAllocationRow
from app.schemas.enums import RoleCode
from app.services import notifications as notify_svc

router = APIRouter(prefix="/de-account-allocation", tags=["DE Account Allocation"])

_de = require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)


async def _account_heads(db: AsyncSession, account_ids: list[UUID]) -> dict[UUID, str]:
    """Primary (non-proxy) Delivery Manager name per account; oldest assignment wins."""
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


async def _project_counts(db: AsyncSession, account_ids: list[UUID]) -> dict[UUID, int]:
    if not account_ids:
        return {}
    result = await db.execute(
        select(Project.account_id, func.count(Project.id))
        .where(Project.account_id.in_(account_ids))
        .group_by(Project.account_id)
    )
    return {account_id: count for account_id, count in result.all()}


async def _rows(db: AsyncSession, account_ids: list[UUID] | None, allocation: str = "all") -> list[DeAccountAllocationRow]:
    de = aliased(User)
    stmt = (
        select(Account, Geo.name, Region.name, de.full_name)
        .outerjoin(Geo, Geo.id == Account.geo_id)
        .outerjoin(Region, Region.id == Account.region_id)
        .outerjoin(de, de.id == Account.delivery_excellence_id)
        .where(Account.is_active.is_(True))
        .order_by(Account.name)
    )
    if account_ids is not None:
        stmt = stmt.where(Account.id.in_(account_ids))
    if allocation == "unallocated":
        stmt = stmt.where(Account.delivery_excellence_id.is_(None))
    elif allocation == "allocated":
        stmt = stmt.where(Account.delivery_excellence_id.is_not(None))
    found = (await db.execute(stmt)).all()
    ids = [account.id for account, *_ in found]
    heads = await _account_heads(db, ids)
    counts = await _project_counts(db, ids)
    return [
        DeAccountAllocationRow(
            account_id=account.id,
            account_name=account.name,
            geo_name=geo_name,
            region_name=region_name,
            critical_flag=account.critical_flag,
            account_head_name=heads.get(account.id),
            project_count=counts.get(account.id, 0),
            delivery_excellence_id=account.delivery_excellence_id,
            delivery_excellence_name=de_name,
            de_allocated_at=account.de_allocated_at,
        )
        for account, geo_name, region_name, de_name in found
    ]


@router.get("", response_model=list[DeAccountAllocationRow], dependencies=[Depends(_de)])
async def list_account_allocation_grid(
    allocation: Literal["unallocated", "allocated", "all"] = Query(
        "unallocated",
        description=(
            "Which active accounts to return: 'unallocated' (no DE auditor yet — "
            "the default work-to-do list), 'allocated' (already have a DE, so a "
            "DE/Admin can reassign or clear them), or 'all'."
        ),
    ),
    db: AsyncSession = Depends(get_db),
):
    return await _rows(db, None, allocation)


@router.patch("/allocations", response_model=list[DeAccountAllocationRow], dependencies=[Depends(_de)])
async def bulk_allocate_accounts(
    payload: DeAccountAllocationBulkAssign,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    now = datetime.now(UTC)
    de_ok: dict[UUID, bool] = {}  # per-request cache of "is this user an active DE"
    changed: list[tuple[Account, UUID]] = []
    touched: list[UUID] = []

    for assignment in payload.assignments:
        account = await db.get(Account, assignment.account_id)
        if account is None or not account.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Account {assignment.account_id} not found")

        new_de = assignment.delivery_excellence_id
        if new_de is not None and new_de not in de_ok:
            user = await db.get(User, new_de)
            role = await db.get(Role, user.role_id) if user is not None else None
            de_ok[new_de] = bool(user is not None and user.is_active and role is not None and role.code == RoleCode.DELIVERY_EXCELLENCE)
        if new_de is not None and not de_ok[new_de]:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"User {new_de} is not an active Delivery Excellence user",
            )

        if account.delivery_excellence_id != new_de:
            account.delivery_excellence_id = new_de
            account.de_allocated_at = now if new_de is not None else None
            if new_de is not None:
                changed.append((account, new_de))
        touched.append(account.id)

    await db.flush()

    for account, new_de in changed:
        await notify_svc.notify(
            db,
            recipient_id=new_de,
            type="DE_ACCOUNT_ALLOCATED",
            title=f"You were allocated account {account.name} for DE audit",
            link="/de-account-allocation",
            entity_type="account",
            entity_id=account.id,
            actor_id=current_user.id,
            data={"account_name": account.name},
        )

    return await _rows(db, touched)
