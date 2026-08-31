from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.api.v1.factory import build_crud_router
from app.core.db import get_db
from app.crud.users import user_crud
from app.models.users import Role, User, UserAccount, UserGeo
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
# every authenticated caller — assessor/assignee dropdowns (DE Allocation, etc.)
# depend on it and are used by non-admin roles.
router.include_router(
    build_crud_router(
        prefix="/users",
        tags=["Users"],
        crud=user_crud,
        read_schema=UserRead,
        create_schema=UserCreate,
        update_schema=UserUpdate,
        write_dependencies=_admin_only,
    ),
)


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
