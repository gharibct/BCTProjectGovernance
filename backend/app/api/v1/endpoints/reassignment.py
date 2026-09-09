"""Reassign Owners — a dedicated screen where a Geo Head, Account Head or
Delivery Excellence user changes a Project's Project Manager, an Account's
Account Manager, or a Geo's Geo Head at any time, with no project-status /
amendment gating.

Mirrors DE Project Allocation (endpoints/de_allocation.py): a small role-gated
router that writes the underlying field/assignment directly, independent of any
workflow. Scope:

- ADMIN / DELIVERY_EXCELLENCE: org-wide reach (same as DE Allocation today).
- GEO_HEAD: only projects / accounts / geos within their own owned geo(s)
  (user_geos), matching require_project_access / project_scope_conditions.
- ACCOUNT_MANAGER: only projects / accounts within their own owned account(s)
  (user_accounts); no Geo Head reassignment at all.

Account Manager and Geo Head are single-owner here: a reassignment deletes any
existing user_accounts / user_geos rows for that account/geo and inserts one,
matching how the rest of the app already assumes one AM / Geo Head per
account/geo (GET /accounts/{id}/account-head, GET /geos/{id}/geo-head both
pick "oldest wins").
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import (
    _owned_account_ids,
    _owned_geo_ids,
    _role_code,
    get_current_user,
    project_scope_conditions,
)
from app.core.db import get_db
from app.models.projects import Project
from app.models.reference_data import Account, Geo, Region
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.enums import RoleCode
from app.schemas.reassignment import (
    ReassignAccountManagerBody,
    ReassignAccountRow,
    ReassignGeoHeadBody,
    ReassignGeoRow,
    ReassignProjectManagerBody,
    ReassignProjectRow,
)

router = APIRouter(prefix="/reassignment", tags=["Reassignment"])

_ALLOWED_ROLES = (
    RoleCode.GEO_HEAD,
    RoleCode.ACCOUNT_MANAGER,
    RoleCode.DELIVERY_EXCELLENCE,
    RoleCode.ADMIN,
)

_FORBIDDEN = HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized for this action.")
_NO_GEO_ACCESS = HTTPException(status.HTTP_403_FORBIDDEN, detail="You do not have access to this geo.")
_NO_ACCOUNT_ACCESS = HTTPException(
    status.HTTP_403_FORBIDDEN, detail="You do not have access to this account."
)


async def _reassigner(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SimpleNamespace:
    """Role gate for every route here. Hands back the resolved role so each
    handler can apply the GEO_HEAD geo-scope check inline (DE/ADMIN skip it),
    the same shape as require_de_findings_write."""
    role_code = await _role_code(db, current_user)
    if role_code not in _ALLOWED_ROLES:
        raise _FORBIDDEN
    return SimpleNamespace(user=current_user, role=role_code)


async def _user_name(db: AsyncSession, user_id: UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await db.get(User, user_id)
    return user.full_name if user is not None else None


async def _current_owner(
    db: AsyncSession, role_codes: tuple[RoleCode, ...], link_model: type, link_col, entity_id: UUID
) -> User | None:
    """The one user whose role is in `role_codes`, linked to `entity_id` via
    `link_model` (UserAccount / UserGeo), oldest wins — mirrors users.py
    _resolve_account_head / _resolve_geo_head."""
    role_ids = (
        (await db.execute(select(Role.id).where(Role.code.in_([r.value for r in role_codes]))))
        .scalars()
        .all()
    )
    if not role_ids:
        return None
    return (
        (
            await db.execute(
                select(User)
                .join(link_model, link_model.user_id == User.id)
                .where(link_col == entity_id, User.role_id.in_(role_ids))
                .order_by(User.created_at)
                .limit(1)
            )
        )
        .scalars()
        .first()
    )


async def _replace_owner(
    db: AsyncSession, link_model: type, link_col, entity_id: UUID, user_id: UUID
) -> None:
    """Single-owner enforcement: drop every existing link row for this entity,
    then add exactly one for `user_id`."""
    existing = (await db.execute(select(link_model).where(link_col == entity_id))).scalars().all()
    for row in existing:
        await db.delete(row)
    now = datetime.now(UTC)
    if link_model is UserAccount:
        db.add(UserAccount(id=uuid4(), user_id=user_id, account_id=entity_id, created_at=now))
    else:
        db.add(UserGeo(id=uuid4(), user_id=user_id, geo_id=entity_id, created_at=now))
    await db.flush()


async def _assert_project_scope(db: AsyncSession, ctx: SimpleNamespace, project: Project) -> None:
    if ctx.role == RoleCode.ACCOUNT_MANAGER:
        if project.account_id is None or project.account_id not in await _owned_account_ids(db, ctx.user):
            raise _NO_ACCOUNT_ACCESS
        return
    if ctx.role != RoleCode.GEO_HEAD:
        return
    owned = await _owned_geo_ids(db, ctx.user)
    if project.geo_id in owned:
        return
    if project.account_id is not None:
        account = await db.get(Account, project.account_id)
        if account is not None and account.geo_id in owned:
            return
    raise _NO_GEO_ACCESS


async def _assert_account_scope(db: AsyncSession, ctx: SimpleNamespace, account: Account) -> None:
    """Account Manager tab write-guard: a Geo Head is bounded by the account's
    geo, an Account Head by their own owned account(s); DE / ADMIN skip both."""
    if ctx.role == RoleCode.ACCOUNT_MANAGER:
        if account.id not in await _owned_account_ids(db, ctx.user):
            raise _NO_ACCOUNT_ACCESS
        return
    if ctx.role != RoleCode.GEO_HEAD:
        return
    if account.geo_id is None or account.geo_id not in await _owned_geo_ids(db, ctx.user):
        raise _NO_GEO_ACCESS


async def _assert_geo_id_scope(db: AsyncSession, ctx: SimpleNamespace, geo_id: UUID | None) -> None:
    # Account Managers have no Geo Head reassignment at all.
    if ctx.role == RoleCode.ACCOUNT_MANAGER:
        raise _FORBIDDEN
    if ctx.role != RoleCode.GEO_HEAD:
        return
    if geo_id is None or geo_id not in await _owned_geo_ids(db, ctx.user):
        raise _NO_GEO_ACCESS


# --- Projects → Project Manager --------------------------------------------


async def _ref_name(db: AsyncSession, model: type, ref_id: UUID | None) -> str | None:
    if ref_id is None:
        return None
    ref = await db.get(model, ref_id)
    return ref.name if ref is not None else None


async def _project_row(db: AsyncSession, project: Project) -> ReassignProjectRow:
    return ReassignProjectRow(
        project_id=project.id,
        project_code=project.project_code,
        project_name=project.project_name,
        account_name=await _ref_name(db, Account, project.account_id),
        geo_name=await _ref_name(db, Geo, project.geo_id),
        region_name=await _ref_name(db, Region, project.region_id),
        project_manager_id=project.project_manager_id,
        project_manager_name=await _user_name(db, project.project_manager_id),
    )


@router.get("/projects", response_model=list[ReassignProjectRow])
async def list_projects(
    ctx: SimpleNamespace = Depends(_reassigner), db: AsyncSession = Depends(get_db)
):
    pm = aliased(User)
    conditions = await project_scope_conditions(db, ctx.user)
    stmt = (
        select(Project, pm.full_name, Account.name, Geo.name, Region.name)
        .outerjoin(pm, pm.id == Project.project_manager_id)
        .outerjoin(Account, Account.id == Project.account_id)
        .outerjoin(Geo, Geo.id == Project.geo_id)
        .outerjoin(Region, Region.id == Project.region_id)
        .where(*conditions)
        .order_by(Project.project_code)
    )
    rows = (await db.execute(stmt)).all()
    return [
        ReassignProjectRow(
            project_id=project.id,
            project_code=project.project_code,
            project_name=project.project_name,
            account_name=account_name,
            geo_name=geo_name,
            region_name=region_name,
            project_manager_id=project.project_manager_id,
            project_manager_name=pm_name,
        )
        for project, pm_name, account_name, geo_name, region_name in rows
    ]


@router.patch("/projects/{project_id}", response_model=ReassignProjectRow)
async def reassign_project_manager(
    project_id: UUID,
    payload: ReassignProjectManagerBody,
    ctx: SimpleNamespace = Depends(_reassigner),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")
    await _assert_project_scope(db, ctx, project)
    project.project_manager_id = payload.project_manager_id
    await db.flush()
    return await _project_row(db, project)


# --- Accounts → Account Manager -------------------------------------------


async def _account_row(db: AsyncSession, account: Account) -> ReassignAccountRow:
    owner = await _current_owner(
        db, (RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD), UserAccount, UserAccount.account_id, account.id
    )
    geo = await db.get(Geo, account.geo_id) if account.geo_id is not None else None
    return ReassignAccountRow(
        account_id=account.id,
        account_name=account.name,
        geo_name=geo.name if geo is not None else None,
        account_manager_id=owner.id if owner is not None else None,
        account_manager_name=owner.full_name if owner is not None else None,
    )


@router.get("/accounts", response_model=list[ReassignAccountRow])
async def list_accounts(
    ctx: SimpleNamespace = Depends(_reassigner), db: AsyncSession = Depends(get_db)
):
    stmt = select(Account).order_by(Account.name)
    if ctx.role == RoleCode.GEO_HEAD:
        owned = await _owned_geo_ids(db, ctx.user)
        stmt = stmt.where(Account.geo_id.in_(owned)) if owned else stmt.where(Account.id.is_(None))
    elif ctx.role == RoleCode.ACCOUNT_MANAGER:
        owned = await _owned_account_ids(db, ctx.user)
        stmt = stmt.where(Account.id.in_(owned)) if owned else stmt.where(Account.id.is_(None))
    accounts = (await db.execute(stmt)).scalars().all()
    return [await _account_row(db, account) for account in accounts]


@router.patch("/accounts/{account_id}", response_model=ReassignAccountRow)
async def reassign_account_manager(
    account_id: UUID,
    payload: ReassignAccountManagerBody,
    ctx: SimpleNamespace = Depends(_reassigner),
    db: AsyncSession = Depends(get_db),
):
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Account not found")
    await _assert_account_scope(db, ctx, account)
    await _replace_owner(db, UserAccount, UserAccount.account_id, account_id, payload.user_id)
    return await _account_row(db, account)


# --- Geos → Geo Head ----------------------------------------------------


async def _geo_row(db: AsyncSession, geo: Geo) -> ReassignGeoRow:
    owner = await _current_owner(db, (RoleCode.GEO_HEAD,), UserGeo, UserGeo.geo_id, geo.id)
    return ReassignGeoRow(
        geo_id=geo.id,
        geo_code=geo.code,
        geo_name=geo.name,
        geo_head_id=owner.id if owner is not None else None,
        geo_head_name=owner.full_name if owner is not None else None,
    )


@router.get("/geos", response_model=list[ReassignGeoRow])
async def list_geos(ctx: SimpleNamespace = Depends(_reassigner), db: AsyncSession = Depends(get_db)):
    # Account Managers do not reassign Geo Heads — the Geo Head tab is hidden
    # for them on the client; return nothing here too.
    if ctx.role == RoleCode.ACCOUNT_MANAGER:
        return []
    stmt = select(Geo).order_by(Geo.name)
    if ctx.role == RoleCode.GEO_HEAD:
        owned = await _owned_geo_ids(db, ctx.user)
        stmt = stmt.where(Geo.id.in_(owned)) if owned else stmt.where(Geo.id.is_(None))
    geos = (await db.execute(stmt)).scalars().all()
    return [await _geo_row(db, geo) for geo in geos]


@router.patch("/geos/{geo_id}", response_model=ReassignGeoRow)
async def reassign_geo_head(
    geo_id: UUID,
    payload: ReassignGeoHeadBody,
    ctx: SimpleNamespace = Depends(_reassigner),
    db: AsyncSession = Depends(get_db),
):
    geo = await db.get(Geo, geo_id)
    if geo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Geo not found")
    await _assert_geo_id_scope(db, ctx, geo_id)
    await _replace_owner(db, UserGeo, UserGeo.geo_id, geo_id, payload.user_id)
    return await _geo_row(db, geo)
