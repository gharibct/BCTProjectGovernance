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

router.include_router(
    build_crud_router(
        prefix="/users",
        tags=["Users"],
        crud=user_crud,
        read_schema=UserRead,
        create_schema=UserCreate,
        update_schema=UserUpdate,
    ),
    dependencies=_admin_only,
)


@router.get("/roles", response_model=list[RoleRead], tags=["Users"], dependencies=_admin_only)
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
