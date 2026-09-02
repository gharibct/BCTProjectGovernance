from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, pagination_params, require_role
from app.api.v1.factory import build_crud_router
from app.core.db import get_db
from app.crud.users import user_crud
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.common import Page
from app.schemas.enums import RoleCode
from app.schemas.users import (
    RoleRead,
    UserAccountsUpdate,
    UserCreate,
    UserGeosUpdate,
    UserRead,
    UserUpdate,
)

router = APIRouter()

_admin_only = [Depends(require_role(RoleCode.ADMIN))]

# Only user create/update/delete is admin-gated; the user list stays readable by
# every authenticated caller — assessor/assignee dropdowns (DE Allocation, the
# Action Tracker, etc.) depend on it and are used by non-admin roles.
#
# `include_list_route=False`: the generic factory list route only offers
# skip/limit, but with 2000+ employees the pickers need server-side search — so
# the list route is hand-written below.
router.include_router(
    build_crud_router(
        prefix="/users",
        tags=["Users"],
        crud=user_crud,
        read_schema=UserRead,
        create_schema=UserCreate,
        update_schema=UserUpdate,
        include_list_route=False,
        write_dependencies=_admin_only,
    ),
)

# Max ids resolvable in one `?ids=` call — a register/list page shows at most a
# few dozen rows, so this is a generous defensive cap, not a real limit.
_MAX_RESOLVE_IDS = 200


@router.get("/users", response_model=Page[UserRead], tags=["Users"])
async def list_users(
    search: str | None = Query(
        default=None, description="ILIKE over full_name, email, ldap_username."
    ),
    is_active: bool | None = Query(default=None),
    role_code: RoleCode | None = Query(default=None),
    ids: str | None = Query(
        default=None,
        description="Comma-separated user UUIDs; returns exactly those, ignoring search/paging.",
    ),
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """Searchable, paginated user directory backing every person picker.

    Ungated for the same reason the old factory list route was — non-admin
    roles need it for assignee/owner dropdowns.
    """
    # Resolve-by-id mode: label already-selected people without loading the
    # whole directory. Bypasses search / is_active / paging by design.
    if ids is not None:
        try:
            id_list = [UUID(part.strip()) for part in ids.split(",") if part.strip()]
        except ValueError as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ids must be comma-separated UUIDs.",
            ) from exc
        if not id_list:
            return Page(items=[], total=0, skip=0, limit=0)
        id_list = id_list[:_MAX_RESOLVE_IDS]
        rows = (
            (
                await db.execute(
                    select(User).where(User.id.in_(id_list)).order_by(User.full_name)
                )
            )
            .scalars()
            .all()
        )
        return Page(items=list(rows), total=len(rows), skip=0, limit=len(rows))

    conditions = []
    if search:
        like = f"%{search}%"
        conditions.append(
            or_(
                User.full_name.ilike(like),
                User.email.ilike(like),
                User.ldap_username.ilike(like),
            )
        )
    if is_active is not None:
        conditions.append(User.is_active == is_active)

    stmt = select(User)
    count_stmt = select(func.count()).select_from(User)
    if role_code is not None:
        stmt = stmt.join(Role, Role.id == User.role_id)
        count_stmt = count_stmt.join(Role, Role.id == User.role_id)
        conditions.append(Role.code == role_code.value)

    total = (await db.execute(count_stmt.where(*conditions))).scalar_one()
    stmt = (
        stmt.where(*conditions)
        .order_by(User.full_name)
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    items = (await db.execute(stmt)).scalars().all()
    return Page(items=list(items), total=total, skip=pagination.skip, limit=pagination.limit)


# Read-only role list — same rationale as the user list above (role-filtered
# dropdowns need it), so it is not admin-gated.
@router.get("/roles", response_model=list[RoleRead], tags=["Users"])
async def list_roles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role))
    return result.scalars().all()


@router.get("/users/{user_id}/accounts", response_model=list[UUID], tags=["Users"], dependencies=_admin_only)
async def get_user_accounts(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserAccount.account_id).where(UserAccount.user_id == user_id))
    return list(result.scalars().all())


@router.get("/users/{user_id}/geos", response_model=list[UUID], tags=["Users"], dependencies=_admin_only)
async def get_user_geos(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == user_id))
    return list(result.scalars().all())


# Reverse of the above (geo -> user): drives Project Profile's read-only
# "Geo Head" field, which auto-derives from whichever user is assigned as
# Geo Head for the project's GEO via the same user_geos mapping. Open read,
# no admin gate, matching /geos and /users list endpoints.
@router.get("/geos/{geo_id}/geo-head", response_model=UserRead | None, tags=["Users"])
async def get_geo_head(geo_id: UUID, db: AsyncSession = Depends(get_db)):
    role = (await db.execute(select(Role).where(Role.code == RoleCode.GEO_HEAD))).scalar_one_or_none()
    if role is None:
        return None
    result = await db.execute(
        select(User)
        .join(UserGeo, UserGeo.user_id == User.id)
        .where(UserGeo.geo_id == geo_id, User.role_id == role.id)
        .order_by(User.created_at)
        .limit(1)
    )
    return result.scalars().first()


# Reverse of user_accounts (account -> user): the Account Head (an
# ACCOUNT_MANAGER assigned to this account). Drives the default owner of an
# Account-level Action; open read, matching get_geo_head above.
@router.get("/accounts/{account_id}/account-head", response_model=UserRead | None, tags=["Users"])
async def get_account_head(account_id: UUID, db: AsyncSession = Depends(get_db)):
    role = (await db.execute(select(Role).where(Role.code == RoleCode.ACCOUNT_MANAGER))).scalar_one_or_none()
    if role is None:
        return None
    result = await db.execute(
        select(User)
        .join(UserAccount, UserAccount.user_id == User.id)
        .where(UserAccount.account_id == account_id, User.role_id == role.id)
        .order_by(User.created_at)
        .limit(1)
    )
    return result.scalars().first()


@router.put("/users/{user_id}/accounts", response_model=list[UUID], tags=["Users"], dependencies=_admin_only)
async def set_user_accounts(
    user_id: UUID, body: UserAccountsUpdate, db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = (
        (await db.execute(select(UserAccount).where(UserAccount.user_id == user_id))).scalars().all()
    )
    existing_ids = {row.account_id for row in existing}
    incoming_ids = set(body.account_ids)

    for row in existing:
        if row.account_id not in incoming_ids:
            await db.delete(row)

    now = datetime.now(UTC)
    for account_id in incoming_ids - existing_ids:
        db.add(UserAccount(id=uuid4(), user_id=user_id, account_id=account_id, created_at=now))

    await db.flush()
    result = (
        (await db.execute(select(UserAccount.account_id).where(UserAccount.user_id == user_id)))
        .scalars()
        .all()
    )
    return list(result)


@router.put("/users/{user_id}/geos", response_model=list[UUID], tags=["Users"], dependencies=_admin_only)
async def set_user_geos(user_id: UUID, body: UserGeosUpdate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = (await db.execute(select(UserGeo).where(UserGeo.user_id == user_id))).scalars().all()
    existing_ids = {row.geo_id for row in existing}
    incoming_ids = set(body.geo_ids)

    for row in existing:
        if row.geo_id not in incoming_ids:
            await db.delete(row)

    now = datetime.now(UTC)
    for geo_id in incoming_ids - existing_ids:
        db.add(UserGeo(id=uuid4(), user_id=user_id, geo_id=geo_id, created_at=now))

    await db.flush()
    result = (
        (await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == user_id))).scalars().all()
    )
    return list(result)
