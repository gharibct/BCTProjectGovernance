from datetime import datetime, timezone
from urllib.parse import urlencode
from uuid import UUID

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.security import hash_password, verify_password
from app.core.session import SESSION_COOKIE_NAME, create_session_token
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.users import (
    LoginRequest,
    PasswordChange,
    RoleRead,
    UserRead,
    UserSessionRead,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

# Browser-navigation endpoints (the Entra redirect out and the redirect back from
# Microsoft). A top-level navigation can't carry the X-API-Key header, so these
# are mounted WITHOUT verify_api_key (see main.py); they're protected by the OIDC
# state/nonce/PKCE round-trip and only ever mint a session for a pre-provisioned user.
redirect_router = APIRouter(prefix="/auth", tags=["Auth"])

oauth = OAuth()
oauth.register(
    name="entra",
    client_id=settings.entra_client_id,
    client_secret=settings.entra_client_secret,
    server_metadata_url=f"{settings.entra_authority}/v2.0/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
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


# Identifier + (optionally) local password login. Serves AUTH_TYPE=no_password
# (dev-only identifier lookup) and AUTH_TYPE=password (identifier + scrypt-hashed
# password). Disabled entirely once AUTH_TYPE=entra so neither path can be
# used to bypass real SSO.
@router.post("/login", response_model=UserSessionRead)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if settings.auth_type not in ("no_password", "password"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Password login is disabled.")

    identifier = body.identifier.strip().lower()
    stmt = select(User).where(
        (func.lower(User.ldap_username) == identifier) | (func.lower(User.email) == identifier)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()

    if settings.auth_type == "password":
        # One generic 401 for every failure mode — unknown identifier, inactive
        # user, no local password on file, wrong password — so the response
        # can't be used to enumerate accounts.
        if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    elif user is None or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No active user found for that identifier")

    _set_session_cookie(response, user.id)
    return await _build_session_read(db, user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Let a signed-in user rotate their own local password. Only meaningful
    under AUTH_TYPE=password; unlike the Admin reset (PUT /users/{id}/password)
    it requires the current password. The new plaintext is scrypt-hashed here
    and is never stored or logged."""
    if settings.auth_type != "password":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Local password change is not available."
        )
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect."
        )
    if body.new_password == body.current_password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )
    current_user.password_hash = hash_password(body.new_password)
    await db.flush()


class NoToolAccessError(HTTPException):
    """Authenticated with Microsoft but not provisioned (or inactive) in the tool."""

    def __init__(self) -> None:
        super().__init__(
            status.HTTP_403_FORBIDDEN,
            detail="No active Project Governance Tool account for that Microsoft account.",
        )


async def resolve_entra_user(db: AsyncSession, claims: dict) -> User:
    """Map verified Entra ID-token claims to a pre-provisioned app user.

    Matches the immutable `oid` first; otherwise falls back to email/UPN
    (case-insensitive) and binds the `oid` on that first match. No JIT
    provisioning: unknown or inactive users get a 403.
    """
    if (claims.get("tid") or "").lower() != settings.entra_tenant_id.lower():
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sign-in from an unexpected tenant.")

    oid = (claims.get("oid") or "").strip().lower()
    if not oid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Entra did not return an oid claim.")

    user = (await db.execute(select(User).where(User.entra_oid == oid))).scalar_one_or_none()
    if user is None:
        # `email` is optional in Entra tokens; preferred_username/upn carry the UPN.
        candidates = {
            (claims.get(key) or "").strip().lower()
            for key in ("email", "preferred_username", "upn")
        } - {""}
        if not candidates:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Entra did not return an email or UPN claim.")
        stmt = select(User).where(func.lower(User.email).in_(candidates))
        matches = (await db.execute(stmt)).scalars().all()
        user = matches[0] if len(matches) == 1 else None
        # A user already bound to a different oid must not be taken over by
        # someone who merely shares the email/UPN.
        if user is not None and user.entra_oid and user.entra_oid != oid:
            user = None
        if user is not None and user.is_active:
            user.entra_oid = oid

    if user is None or not user.is_active:
        raise NoToolAccessError()
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    return user


@redirect_router.get("/entra/login")
async def entra_login(request: Request):
    if settings.auth_type != "entra":
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return await oauth.entra.authorize_redirect(request, settings.entra_redirect_uri)


@redirect_router.get("/entra/callback")
async def entra_callback(request: Request, db: AsyncSession = Depends(get_db)):
    if settings.auth_type != "entra":
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    token = await oauth.entra.authorize_access_token(request)
    try:
        user = await resolve_entra_user(db, token.get("userinfo") or {})
    except NoToolAccessError:
        # Browser navigation: show a friendly page instead of raw JSON.
        return RedirectResponse(url=f"{settings.frontend_base_url}/login/no-access")

    response = RedirectResponse(url=f"{settings.frontend_base_url}/login/callback")
    _set_session_cookie(response, user.id)
    return response


@router.get("/me", response_model=UserSessionRead)
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_session_read(db, current_user)


@router.post("/logout")
async def logout(response: Response) -> dict[str, str | None]:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    logout_url = None
    if settings.auth_type == "entra":
        logout_url = (
            f"{settings.entra_authority}/oauth2/v2.0/logout"
            f"?{urlencode({'post_logout_redirect_uri': f'{settings.frontend_base_url}/login'})}"
        )
    return {"logout_url": logout_url}
