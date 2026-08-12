from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.users import LoginRequest, RoleRead, UserRead, UserSessionRead

router = APIRouter(prefix="/auth", tags=["Auth"])


# No password check — this prototype has no auth system yet (see
# frontend/src/lib/api/client.ts); identifier just has to resolve to an
# active user so the frontend can carry their role/scope forward.
@router.post("/login", response_model=UserSessionRead)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    identifier = body.identifier.strip().lower()
    stmt = select(User).where(
        (func.lower(User.ldap_username) == identifier) | (func.lower(User.email) == identifier)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No active user found for that identifier")

    role = await db.get(Role, user.role_id)

    geo_ids = (await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == user.id))).scalars().all()
    account_ids = (
        (await db.execute(select(UserAccount.account_id).where(UserAccount.user_id == user.id))).scalars().all()
    )

    return UserSessionRead(
        **UserRead.model_validate(user).model_dump(),
        role=RoleRead.model_validate(role),
        geo_ids=list(geo_ids),
        account_ids=list(account_ids),
    )
