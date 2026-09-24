import re
from dataclasses import dataclass
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID

from fastapi import Depends, HTTPException, Query, Request, status
from sqlalchemy import false, or_, select, update
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


async def project_scope_conditions(db: AsyncSession, user: User) -> list:
    """SQLAlchemy WHERE conditions restricting a `select(Project)` to what the
    caller may see in a project LIST (GET /projects):

    - ADMIN / DELIVERY_EXCELLENCE / PMO / CDO: no restriction (they need
      cross-portfolio reads — the DE Projects browser, Project Health, the
      account/geo dashboards).
    - PROJECT_MANAGER: only projects they manage.
    - ACCOUNT_MANAGER: only projects in their owned accounts.
    - GEO_HEAD: only projects in their owned geo(s), directly or via the
      project's account (mirrors require_project_access).
    - anything else (e.g. TEAM_MEMBER): nothing.
    """
    role_code = await _role_code(db, user)
    if role_code in (RoleCode.ADMIN, RoleCode.DELIVERY_EXCELLENCE, RoleCode.PMO, RoleCode.CDO):
        return []
    if role_code == RoleCode.PROJECT_MANAGER:
        return [Project.project_manager_id == user.id]
    if role_code == RoleCode.ACCOUNT_MANAGER:
        account_ids = await _owned_account_ids(db, user)
        return [Project.account_id.in_(account_ids)] if account_ids else [false()]
    if role_code == RoleCode.GEO_HEAD:
        geo_ids = await _owned_geo_ids(db, user)
        if not geo_ids:
            return [false()]
        return [
            or_(
                Project.geo_id.in_(geo_ids),
                Project.account_id.in_(select(Account.id).where(Account.geo_id.in_(geo_ids))),
            )
        ]
    return [false()]


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
    Action Tracker's GEO-level write gate passes bypass_roles=(ADMIN, CDO) —
    CDO already reviews geo-level reports without ownership scoping (see
    regional_status.py's `_cdo_review = require_role(CDO, ADMIN)`)."""

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


def require_account_or_geo_scope(*allowed_roles: RoleCode, bypass_roles: tuple[RoleCode, ...] = (RoleCode.ADMIN,)):
    """Role check plus: the `account_id` path param must either be owned
    directly (user_accounts, e.g. an Account Manager) or belong to one of the
    caller's owned geos (user_geos, e.g. a Geo Head reviewing that account),
    unless the caller's role is in `bypass_roles` (defaults to ADMIN only,
    preserving every existing caller's behavior). Covers write actions on an
    account-scoped page that both an owning Account Manager and a reviewing
    Geo Head can perform — see actions.py, whose account-review "Actions"
    tracker create/edit dependency needs exactly this, unlike
    require_account_scope's ownership-only check."""

    async def dependency(
        account_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        role_code = await _role_code(db, current_user)
        if role_code not in allowed_roles:
            raise _FORBIDDEN
        if role_code in bypass_roles:
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


def require_project_de_assessment_access(*allowed_roles: RoleCode):
    """Role check plus: the `project_id` path param's project must have a DE
    allocated (project.delivery_excellence_id is not None).

    This does NOT require the caller to be that DE — any user in an allowed
    role may act on any project that has been allocated to Delivery Excellence
    (all DEs are treated equally, and every DE sees every DE project). ADMIN
    bypasses the allocation check. Used by the DE Assessment and DE Approval
    write routes."""

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
            if project is None or project.delivery_excellence_id is None:
                raise _FORBIDDEN
        return current_user

    return dependency


@dataclass
class DEFindingReadScope:
    """Resolved read scope for GET /de-findings and /de-findings/kpis — see
    require_de_findings_read_scope. `restrict_geo_ids`/`restrict_account_ids`
    are enforced server-side in addition to (never instead of) the caller's
    own geo_id/account_id query params."""

    geo_id: UUID | None = None
    account_id: UUID | None = None
    project_id: UUID | None = None
    restrict_geo_ids: set[UUID] | None = None
    restrict_account_ids: set[UUID] | None = None


async def require_de_findings_read_scope(
    geo_id: UUID | None = None,
    account_id: UUID | None = None,
    project_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DEFindingReadScope:
    """Read gate + patch scoping for the portfolio DE Findings list/KPI routes.

    DELIVERY_EXCELLENCE / ADMIN / CDO read unrestricted (DE and ADMIN always
    have; CDO is org-wide everywhere else too — see project_scope_conditions).
    GEO_HEAD is restricted to their own owned geos: an explicit `geo_id` must
    be one of them (else 403), otherwise the query is force-restricted to all
    of them. ACCOUNT_MANAGER is restricted the same way over owned accounts.
    Every other role is forbidden."""
    role_code = await _role_code(db, current_user)
    if role_code not in (
        RoleCode.DELIVERY_EXCELLENCE,
        RoleCode.ADMIN,
        RoleCode.CDO,
        RoleCode.GEO_HEAD,
        RoleCode.ACCOUNT_MANAGER,
    ):
        raise _FORBIDDEN
    if role_code in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN, RoleCode.CDO):
        return DEFindingReadScope(geo_id=geo_id, account_id=account_id, project_id=project_id)
    if role_code == RoleCode.GEO_HEAD:
        owned_geos = await _owned_geo_ids(db, current_user)
        if geo_id is not None:
            if geo_id not in owned_geos:
                raise _NO_GEO_ACCESS
            return DEFindingReadScope(geo_id=geo_id, account_id=account_id, project_id=project_id)
        return DEFindingReadScope(
            account_id=account_id, project_id=project_id, restrict_geo_ids=owned_geos
        )
    # ACCOUNT_MANAGER
    owned_accounts = await _owned_account_ids(db, current_user)
    if account_id is not None:
        if account_id not in owned_accounts:
            raise _NO_ACCOUNT_ACCESS
        return DEFindingReadScope(account_id=account_id, project_id=project_id)
    return DEFindingReadScope(project_id=project_id, restrict_account_ids=owned_accounts)


async def check_de_finding_history_access(db: AsyncSession, user: User, project: Project | None) -> None:
    """Same role/patch rules as require_de_findings_read_scope, but for
    GET /de-findings/{id}/history, which has no geo_id/account_id query param
    to scope on — only the finding's own project. Raises 403 if not allowed;
    a missing project (delivery_excellence_id-less or already deleted) is
    treated as "no access" for GEO_HEAD/ACCOUNT_MANAGER."""
    role_code = await _role_code(db, user)
    if role_code in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN, RoleCode.CDO):
        return
    if role_code == RoleCode.GEO_HEAD and project is not None:
        owned_geos = await _owned_geo_ids(db, user)
        if project.geo_id in owned_geos:
            return
        if project.account_id is not None:
            account = await db.get(Account, project.account_id)
            if account is not None and account.geo_id in owned_geos:
                return
        raise _NO_GEO_ACCESS
    if role_code == RoleCode.ACCOUNT_MANAGER and project is not None:
        if project.account_id in await _owned_account_ids(db, user):
            return
        raise _NO_ACCOUNT_ACCESS
    raise _FORBIDDEN


async def require_de_findings_write(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SimpleNamespace:
    """Role gate for the portfolio POST/PUT /de-findings routes. The project is
    not a path param here (it rides in the body on create, on the finding on
    update), so the per-project "DE allocated" check is done inline in the
    handler — this only enforces the role and hands back the resolved role so
    the handler can let ADMIN bypass that check."""
    role_code = await _role_code(db, current_user)
    if role_code not in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN):
        raise _FORBIDDEN
    return SimpleNamespace(user=current_user, role=role_code)


async def require_pm_findings_write(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SimpleNamespace:
    """Role gate for PUT /pm-findings/{id}/action-taken. Like
    require_de_findings_write but for the PM: the per-project "is this my
    project" check (project.project_manager_id == caller) is done inline in the
    handler; ADMIN bypasses it."""
    role_code = await _role_code(db, current_user)
    if role_code not in (RoleCode.PROJECT_MANAGER, RoleCode.ADMIN):
        raise _FORBIDDEN
    return SimpleNamespace(user=current_user, role=role_code)


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


def require_project_read_access(*extra_bypass_roles: RoleCode):
    """Project-scoped READ gate (list/get sub-resources under /projects/{id}/...).

    Unlike require_project_access (the write gate above), this checks the
    project's existence *before* role/ownership, so a nonexistent project still
    404s for every caller (matching GET /projects/{id}'s long-standing
    behavior — see test_get_project_not_found_returns_404_not_403) instead of
    403ing for AM/GEO_HEAD before the DB is even consulted.

    ADMIN / PROJECT_MANAGER / DELIVERY_EXCELLENCE / PMO / CDO bypass
    unconditionally — this mirrors project_scope_conditions' treatment of
    these roles on GET /projects (list), which already grants PMO/CDO
    unrestricted cross-portfolio reads. (require_project_access's own bypass
    set only covers ADMIN/PROJECT_MANAGER/DELIVERY_EXCELLENCE — reusing it
    verbatim for reads would wrongly narrow PMO/CDO's existing access.)
    ACCOUNT_MANAGER / GEO_HEAD are ownership-scoped exactly as in
    require_project_access. Every other role gets 403."""

    bypass_roles = (
        RoleCode.ADMIN,
        RoleCode.PROJECT_MANAGER,
        RoleCode.DELIVERY_EXCELLENCE,
        RoleCode.PMO,
        RoleCode.CDO,
        *extra_bypass_roles,
    )

    async def dependency(
        project_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        project = await db.get(Project, project_id)
        if project is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")
        role_code = await _role_code(db, current_user)
        if role_code in bypass_roles:
            return current_user
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
