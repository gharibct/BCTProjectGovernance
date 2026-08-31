import re
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, HTTPException, Query, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.session import SESSION_COOKIE_NAME, decode_session_token
from app.models.projects import Project
from app.models.reference_data import Account
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.enums import RoleCode


@dataclass
class PaginationParams:
    skip: int = 0
    limit: int = 50


def pagination_params(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> PaginationParams:
    return PaginationParams(skip=skip, limit=limit)


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    user_id = decode_session_token(token) if token else None
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    return user


async def _role_code(db: AsyncSession, user: User) -> RoleCode | None:
    role = await db.get(Role, user.role_id)
    if role is None:
        return None
    try:
        return RoleCode(role.code)
    except ValueError:
        return None


async def _owned_account_ids(db: AsyncSession, user: User) -> set[UUID]:
    rows = (await db.execute(select(UserAccount.account_id).where(UserAccount.user_id == user.id))).scalars().all()
    return set(rows)


async def _owned_geo_ids(db: AsyncSession, user: User) -> set[UUID]:
    rows = (await db.execute(select(UserGeo.geo_id).where(UserGeo.user_id == user.id))).scalars().all()
    return set(rows)


_FORBIDDEN = HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized for this action.")
_NO_ACCOUNT_ACCESS = HTTPException(status.HTTP_403_FORBIDDEN, detail="You do not have access to this account.")
_NO_GEO_ACCESS = HTTPException(status.HTTP_403_FORBIDDEN, detail="You do not have access to this geo.")


def require_role(*allowed_roles: RoleCode):
    """Raises 403 unless current_user.role.code is one of allowed_roles."""

    async def dependency(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        return current_user

    return dependency


def require_account_scope(*allowed_roles: RoleCode):
    """Role check plus: the `account_id` path param must be one of the
    caller's owned accounts (user_accounts), unless the caller is ADMIN."""

    async def dependency(
        account_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code != RoleCode.ADMIN and account_id not in await _owned_account_ids(db, current_user):
            raise _NO_ACCOUNT_ACCESS
        return current_user

    return dependency


def require_geo_scope(*allowed_roles: RoleCode, bypass_roles: tuple[RoleCode, ...] = (RoleCode.ADMIN,)):
    """Role check plus: the `geo_id` path param must be one of the caller's
    owned geos (user_geos), unless the caller's role is in `bypass_roles`
    (defaults to ADMIN only, preserving every existing caller's behavior).
    Action Tracker's GEO-level write gate passes bypass_roles=(ADMIN, CXO) —
    CXO already reviews geo-level reports without ownership scoping (see
    regional_status.py's `_cxo_review = require_role(CXO, ADMIN)`)."""

    async def dependency(
        geo_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code not in bypass_roles and geo_id not in await _owned_geo_ids(db, current_user):
            raise _NO_GEO_ACCESS
        return current_user

    return dependency


def require_account_or_geo_scope(*allowed_roles: RoleCode):
    """Role check plus: the `account_id` path param must either be owned
    directly (user_accounts, e.g. an Account Manager) or belong to one of the
    caller's owned geos (user_geos, e.g. a Geo Head reviewing that account),
    unless the caller is ADMIN. Covers write actions on an account-scoped page
    that both an owning Account Manager and a reviewing Geo Head can perform —
    see actions.py, whose account-review "Actions" tracker create/edit
    dependency needs exactly this, unlike require_account_scope's
    ownership-only check."""

    async def dependency(
        account_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code == RoleCode.ADMIN:
            return current_user
        if account_id in await _owned_account_ids(db, current_user):
            return current_user
        account = await db.get(Account, account_id)
        if account is not None and account.geo_id is not None and account.geo_id in await _owned_geo_ids(db, current_user):
            return current_user
        raise _NO_ACCOUNT_ACCESS

    return dependency


def require_project_account_scope(*allowed_roles: RoleCode):
    """Role check plus: the `project_id` path param's project must belong to
    one of the caller's owned accounts, unless the caller is ADMIN."""

    async def dependency(
        project_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code != RoleCode.ADMIN:
            project = await db.get(Project, project_id)
            if project is None or project.account_id is None:
                raise _NO_ACCOUNT_ACCESS
            if project.account_id not in await _owned_account_ids(db, current_user):
                raise _NO_ACCOUNT_ACCESS
        return current_user

    return dependency


def require_project_de_scope(*allowed_roles: RoleCode):
    """Role check plus: the `project_id` path param's project must be allocated
    to the caller (project.delivery_excellence_id == current_user.id), unless
    the caller is ADMIN. Used by the DE Project Approval write routes so a DE
    can only review/decide projects allocated to them."""

    async def dependency(
        project_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code != RoleCode.ADMIN:
            project = await db.get(Project, project_id)
            if project is None or project.delivery_excellence_id != current_user.id:
                raise _FORBIDDEN
        return current_user

    return dependency


def require_project_access(*allowed_roles: RoleCode):
    """Project-scoped write gate for the top-bar Work Context (act-as-lower-role).

    The caller's role must be in `allowed_roles`. PROJECT_MANAGER /
    DELIVERY_EXCELLENCE / ADMIN pass unconditionally — their existing behaviour,
    since no per-project ownership exists in the schema for them. ACCOUNT_MANAGER
    passes only when the `{project_id}` project is in one of their owned accounts;
    GEO_HEAD only when the project's `geo_id` — or its account's `geo_id` — is one
    of their owned geos. This lets an Account/Geo Head do PM work on projects in
    their own patch."""

    async def dependency(
        project_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code in (RoleCode.ADMIN, RoleCode.PROJECT_MANAGER, RoleCode.DELIVERY_EXCELLENCE):
            return current_user
        project = await db.get(Project, project_id)
        if project is None:
            raise _FORBIDDEN
        if role_code == RoleCode.ACCOUNT_MANAGER:
            if project.account_id in await _owned_account_ids(db, current_user):
                return current_user
        elif role_code == RoleCode.GEO_HEAD:
            owned_geos = await _owned_geo_ids(db, current_user)
            if project.geo_id in owned_geos:
                return current_user
            if project.account_id is not None:
                account = await db.get(Account, project.account_id)
                if account is not None and account.geo_id in owned_geos:
                    return current_user
        raise _FORBIDDEN

    return dependency


def require_account_geo_scope(*allowed_roles: RoleCode):
    """Role check plus: the `account_id` path param's account must belong to
    one of the caller's owned geos, unless the caller is ADMIN."""

    async def dependency(
        account_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code != RoleCode.ADMIN:
            account = await db.get(Account, account_id)
            if account is None or account.geo_id is None:
                raise _NO_GEO_ACCESS
            if account.geo_id not in await _owned_geo_ids(db, current_user):
                raise _NO_GEO_ACCESS
        return current_user

    return dependency


# Any write to a project-scoped route (charter, reporting registers, DE review,
# ...) marks the project as "recently touched" so the sidebar can order projects
# by real activity — projects.updated_at is otherwise only bumped by a handful
# of endpoints that happen to write the projects row. This rides get_db (which
# tests override with a no-op FakeDB), so it's inert in unit tests and commits
# together with the endpoint's own writes on Postgres/SQLite.
_PROJECT_WRITE_PATH = re.compile(r"^/api/v1/(?:projects|de-approval)/([0-9a-fA-F-]{36})/")
_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def touch_project_on_write(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        yield
    except Exception:
        raise  # the request failed — don't record activity
    if request.method not in _MUTATING_METHODS:
        return
    match = _PROJECT_WRITE_PATH.match(request.url.path)
    if match is None:
        return
    try:
        await db.execute(
            update(Project)
            .where(Project.id == UUID(match.group(1)))
            .values(updated_at=datetime.now(UTC))
        )
        # get_db commits this alongside the endpoint's own writes.
    except Exception:
        pass  # a failed activity bump must never break the response
