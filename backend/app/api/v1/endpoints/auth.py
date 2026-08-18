from uuid import UUID

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.session import SESSION_COOKIE_NAME, create_session_token
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.users import LoginRequest, RoleRead, UserRead, UserSessionRead

router = APIRouter(prefix="/auth", tags=["Auth"])

oauth = OAuth()
oauth.register(
    name="onelogin",
    client_id=settings.onelogin_client_id,
    client_secret=settings.onelogin_client_secret,
    server_metadata_url=f"{settings.onelogin_issuer}/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def _set_session_cookie(response: Response, user_id: UUID) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_token(user_id),
        max_age=settings.session_ttl_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


async def _build_session_read(db: AsyncSession, user: User) -> UserSessionRead:
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


@router.get("/config")
async def auth_config() -> dict[str, str]:
    return {"auth_type": settings.auth_type}


# No password check — dev-only fallback (see settings.auth_type). Disabled
# once AUTH_TYPE=onelogin so the identifier-only path can't be used to bypass
# real SSO.
@router.post("/login", response_model=UserSessionRead)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if settings.auth_type != "no_password":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Password-less login is disabled.")

    identifier = body.identifier.strip().lower()
    stmt = select(User).where(
        (func.lower(User.ldap_username) == identifier) | (func.lower(User.email) == identifier)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No active user found for that identifier")

    _set_session_cookie(response, user.id)
    return await _build_session_read(db, user)


@router.get("/onelogin/login")
async def onelogin_login(request: Request):
    if settings.auth_type != "onelogin":
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return await oauth.onelogin.authorize_redirect(request, settings.onelogin_redirect_uri)


@router.get("/onelogin/callback")
async def onelogin_callback(request: Request, db: AsyncSession = Depends(get_db)):
    if settings.auth_type != "onelogin":
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    token = await oauth.onelogin.authorize_access_token(request)
    claims = token.get("userinfo") or {}
    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="OneLogin did not return an email claim.")

    stmt = select(User).where(func.lower(User.email) == email)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None or not user.is_active:
        # Strict pre-provisioned policy: OneLogin authenticated this person,
        # but no admin has created an app account for them yet — no JIT
        # auto-provisioning.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="No active Project Governance Tool account for that email.",
        )

    response = RedirectResponse(url=f"{settings.frontend_base_url}/login/callback")
    _set_session_cookie(response, user.id)
    return response


@router.get("/me", response_model=UserSessionRead)
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_session_read(db, current_user)


@router.post("/logout")
async def logout(response: Response) -> dict[str, str | None]:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    logout_url = f"{settings.onelogin_issuer}/logout" if settings.auth_type == "onelogin" else None
    return {"logout_url": logout_url}
