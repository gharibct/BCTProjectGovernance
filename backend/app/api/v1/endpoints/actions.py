"""Screen-level Action Tracker — design-reference/action-table-design.md,
design-reference/Action-Tracker.html. Not tied to any one screen/section: an
action is scoped to a Geo, Account, or Project via level+level_value (see
db/tables/44_actions.sql) and shows up on every screen for that entity.
Hand-written (not the RAID router factory) but still one shared
implementation across all three levels via ActionLevelConfig, mirroring
RaidConfig/build_raid_router in raid.py — level_value is a flat,
unconstrained identifier (the entity's UUID as text), not a per-level FK
column, since every Action field is identical regardless of level.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_account_or_geo_scope, require_geo_scope, require_role
from app.core.db import get_db
from app.crud.actions import action_crud, action_history_crud
from app.models.actions import Action, ActionHistory
from app.models.projects import Project
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.actions import (
    ActionCommentCreate,
    ActionCreate,
    ActionHistoryCreate,
    ActionHistoryRead,
    ActionRead,
    ActionUpdate,
)
from app.schemas.enums import ActionHistoryEventType, ActionLevel, ActionStatus, RoleCode
from app.services.code_generator import generate_code

_TRANSITION_DENIED = "Only the action's owner or an authorized manager can do this."

# --- Per-level write checks. Used two ways:
#  1. Raw, as a route-level `dependencies=[Depends(...)]` on create/update —
#     this runs (and can 403) before FastAPI validates the request body, so a
#     wrong-role POST/PUT with a bad payload still 403s instead of 422ing.
#     Requires the route's path segment to literally be named to match (see
#     ActionLevelConfig.path_param / Path(alias=...) below).
#  2. Wrapped as an (db, entity_id, current_user) callable (below) for
#     transition endpoints, which need an owner-bypass check *after* fetching
#     the action — inherently can't happen purely via Depends(). ---

_account_or_geo_scope = require_account_or_geo_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN)
_geo_scope = require_geo_scope(RoleCode.GEO_HEAD, RoleCode.CXO, RoleCode.ADMIN, bypass_roles=(RoleCode.ADMIN, RoleCode.CXO))
_project_role = require_role(RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)


async def _account_write_check(db: AsyncSession, entity_id: UUID, current_user: User) -> None:
    await _account_or_geo_scope(account_id=entity_id, current_user=current_user, db=db)


async def _geo_write_check(db: AsyncSession, entity_id: UUID, current_user: User) -> None:
    await _geo_scope(geo_id=entity_id, current_user=current_user, db=db)


async def _project_write_check(db: AsyncSession, entity_id: UUID, current_user: User) -> None:
    await _project_role(current_user=current_user, db=db)


def _owner_or(write_check: Callable[[AsyncSession, UUID, User], Awaitable[None]]):
    """A transition (start/complete/close/cancel/comment) is allowed for the
    action's own assignee regardless of role/scope, or for anyone who'd pass
    the level's write check."""

    async def check(db: AsyncSession, entity_id: UUID, action: Action, current_user: User) -> None:
        if current_user.id == action.action_by_id:
            return
        try:
            await write_check(db, entity_id, current_user)
        except HTTPException as exc:
            raise HTTPException(status.HTTP_403_FORBIDDEN, _TRANSITION_DENIED) from exc

    return check


async def _project_manager_default(db: AsyncSession, project_id: UUID) -> UUID | None:
    project = await db.get(Project, project_id)
    return project.project_manager_id if project else None


async def _first_user_for_scope(db: AsyncSession, role_code: RoleCode, join_model, join_col, scope_value: UUID) -> UUID | None:
    """First user (by created_at) holding `role_code` and mapped to the given
    geo/account via user_geos / user_accounts — the entity's Geo Head /
    Account Head, used to default an Action's owner."""
    rows = (
        await db.execute(
            select(User.id)
            .join(join_model, join_model.user_id == User.id)
            .join(Role, Role.id == User.role_id)
            .where(join_col == scope_value, Role.code == role_code)
            .order_by(User.created_at)
            .limit(1)
        )
    ).scalars().all()
    return rows[0] if rows else None


async def _geo_head_default(db: AsyncSession, geo_id: UUID) -> UUID | None:
    return await _first_user_for_scope(db, RoleCode.GEO_HEAD, UserGeo, UserGeo.geo_id, geo_id)


async def _account_head_default(db: AsyncSession, account_id: UUID) -> UUID | None:
    return await _first_user_for_scope(db, RoleCode.ACCOUNT_MANAGER, UserAccount, UserAccount.account_id, account_id)


@dataclass
class ActionLevelConfig:
    level: ActionLevel
    url_prefix: str  # "geos" | "accounts" | "projects"
    path_param: str  # "geo_id" | "account_id" | "project_id" — must match write_dependency's own param name
    write_dependency: Callable  # raw deps.py dependency, used via Depends() on create/update
    transition_check: Callable[[AsyncSession, UUID, Action, User], Awaitable[None]]
    default_owner: Callable[[AsyncSession, UUID], Awaitable[UUID | None]] | None = None


async def _get_scoped(db: AsyncSession, cfg: ActionLevelConfig, entity_id: UUID, action_id: UUID) -> Action:
    obj = await action_crud.get(db, action_id)
    if obj is None or obj.level != cfg.level or obj.level_value != str(entity_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action not found")
    return obj


async def _add_history(
    db: AsyncSession,
    action_id: UUID,
    event_type: ActionHistoryEventType,
    current_user: User,
    *,
    comment: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> ActionHistory:
    return await action_history_crud.create(
        db,
        ActionHistoryCreate(
            action_id=action_id,
            event_type=event_type,
            comment=comment,
            old_value=old_value,
            new_value=new_value,
            created_by=current_user.id,
        ),
    )


def build_action_router(cfg: ActionLevelConfig) -> APIRouter:
    router = APIRouter(prefix=f"/{cfg.url_prefix}/{{{cfg.path_param}}}/actions", tags=["Action Tracker"])

    def entity_id_param() -> UUID:
        return Path(alias=cfg.path_param)

    @router.get("", response_model=list[ActionRead])
    async def list_actions(
        entity_id: UUID = entity_id_param(),
        status_filter: ActionStatus | None = Query(default=None, alias="status"),
        action_by_id: UUID | None = Query(default=None),
        db: AsyncSession = Depends(get_db),
    ):
        filters: dict = {Action.level: cfg.level, Action.level_value: str(entity_id)}
        if status_filter is not None:
            filters[Action.status] = status_filter
        if action_by_id is not None:
            filters[Action.action_by_id] = action_by_id
        items, _ = await action_crud.list(db, filters=filters, order_by=Action.due_date.asc(), limit=200)
        return items

    @router.get("/{action_id}", response_model=ActionRead)
    async def get_action(action_id: UUID, entity_id: UUID = entity_id_param(), db: AsyncSession = Depends(get_db)):
        return await _get_scoped(db, cfg, entity_id, action_id)

    @router.get("/{action_id}/history", response_model=list[ActionHistoryRead])
    async def get_action_history(
        action_id: UUID, entity_id: UUID = entity_id_param(), db: AsyncSession = Depends(get_db)
    ):
        await _get_scoped(db, cfg, entity_id, action_id)
        items, _ = await action_history_crud.list(
            db,
            filters={ActionHistory.action_id: action_id},
            order_by=ActionHistory.created_at.asc(),
            limit=500,
        )
        return items

    # Action creation is deliberately open to any authenticated user at any
    # level (product decision) — no per-level write gate here, unlike update /
    # transitions below which still enforce cfg.write_dependency / transition_check.
    @router.post("", response_model=ActionRead, status_code=status.HTTP_201_CREATED)
    async def create_action(
        payload: ActionCreate,
        entity_id: UUID = entity_id_param(),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        action_by_id = payload.action_by_id
        if action_by_id is None and cfg.default_owner is not None:
            action_by_id = await cfg.default_owner(db, entity_id)
        if action_by_id is None:
            action_by_id = current_user.id

        code = await generate_code(db, "ACTION")
        obj = await action_crud.create(
            db,
            payload,
            action_code=code,
            level=cfg.level,
            level_value=str(entity_id),
            action_by_id=action_by_id,
            status=ActionStatus.OPEN,
            raised_by=current_user.id,
            raised_at=datetime.now(UTC),
        )
        await _add_history(db, obj.id, ActionHistoryEventType.CREATED, current_user)
        return obj

    @router.put("/{action_id}", response_model=ActionRead, dependencies=[Depends(cfg.write_dependency)])
    async def update_action(
        action_id: UUID,
        payload: ActionUpdate,
        entity_id: UUID = entity_id_param(),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        obj = await _get_scoped(db, cfg, entity_id, action_id)
        old_owner, old_due_date, old_priority = obj.action_by_id, obj.due_date, obj.priority

        obj = await action_crud.update(db, obj, payload)

        if payload.action_by_id is not None and payload.action_by_id != old_owner:
            await _add_history(
                db,
                obj.id,
                ActionHistoryEventType.OWNER_CHANGE,
                current_user,
                old_value=str(old_owner),
                new_value=str(obj.action_by_id),
            )
        if payload.due_date is not None and payload.due_date != old_due_date:
            await _add_history(
                db,
                obj.id,
                ActionHistoryEventType.DUE_DATE_CHANGE,
                current_user,
                old_value=old_due_date.isoformat(),
                new_value=obj.due_date.isoformat(),
            )
        if payload.priority is not None and payload.priority != old_priority:
            await _add_history(
                db,
                obj.id,
                ActionHistoryEventType.PRIORITY_CHANGE,
                current_user,
                old_value=old_priority,
                new_value=obj.priority,
            )
        return obj

    async def _transition(
        entity_id: UUID,
        action_id: UUID,
        current_user: User,
        db: AsyncSession,
        *,
        from_statuses: tuple[ActionStatus, ...],
        to_status: ActionStatus,
        extra: dict | None = None,
    ) -> Action:
        obj = await _get_scoped(db, cfg, entity_id, action_id)
        await cfg.transition_check(db, entity_id, obj, current_user)
        if obj.status not in from_statuses:
            allowed = "/".join(from_statuses)
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Action must be {allowed} for this transition")

        old_status = obj.status
        obj.status = to_status
        for field, value in (extra or {}).items():
            setattr(obj, field, value)
        await db.flush()
        await db.refresh(obj)
        await _add_history(
            db, obj.id, ActionHistoryEventType.STATUS_CHANGE, current_user, old_value=old_status, new_value=to_status
        )
        return obj

    @router.patch("/{action_id}/start", response_model=ActionRead)
    async def start_action(
        action_id: UUID,
        entity_id: UUID = entity_id_param(),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        return await _transition(
            entity_id,
            action_id,
            current_user,
            db,
            from_statuses=(ActionStatus.OPEN,),
            to_status=ActionStatus.IN_PROGRESS,
        )

    @router.patch("/{action_id}/complete", response_model=ActionRead)
    async def complete_action(
        action_id: UUID,
        entity_id: UUID = entity_id_param(),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        return await _transition(
            entity_id,
            action_id,
            current_user,
            db,
            from_statuses=(ActionStatus.OPEN, ActionStatus.IN_PROGRESS),
            to_status=ActionStatus.COMPLETED,
            extra={"completed_at": datetime.now(UTC)},
        )

    @router.patch("/{action_id}/close", response_model=ActionRead)
    async def close_action(
        action_id: UUID,
        entity_id: UUID = entity_id_param(),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        return await _transition(
            entity_id,
            action_id,
            current_user,
            db,
            from_statuses=(ActionStatus.COMPLETED,),
            to_status=ActionStatus.CLOSED,
            extra={"closed_at": datetime.now(UTC), "closed_by": current_user.id},
        )

    @router.patch("/{action_id}/cancel", response_model=ActionRead)
    async def cancel_action(
        action_id: UUID,
        entity_id: UUID = entity_id_param(),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        return await _transition(
            entity_id,
            action_id,
            current_user,
            db,
            from_statuses=(ActionStatus.OPEN, ActionStatus.IN_PROGRESS),
            to_status=ActionStatus.CANCELLED,
        )

    @router.post("/{action_id}/comments", response_model=ActionHistoryRead, status_code=status.HTTP_201_CREATED)
    async def add_comment(
        action_id: UUID,
        payload: ActionCommentCreate,
        entity_id: UUID = entity_id_param(),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        obj = await _get_scoped(db, cfg, entity_id, action_id)
        await cfg.transition_check(db, entity_id, obj, current_user)
        return await _add_history(db, obj.id, ActionHistoryEventType.COMMENT, current_user, comment=payload.text)

    return router


ACTION_LEVEL_CONFIGS = [
    ActionLevelConfig(
        level=ActionLevel.GEO,
        url_prefix="geos",
        path_param="geo_id",
        write_dependency=_geo_scope,
        transition_check=_owner_or(_geo_write_check),
        default_owner=_geo_head_default,
    ),
    ActionLevelConfig(
        level=ActionLevel.ACCOUNT,
        url_prefix="accounts",
        path_param="account_id",
        write_dependency=_account_or_geo_scope,
        transition_check=_owner_or(_account_write_check),
        default_owner=_account_head_default,
    ),
    ActionLevelConfig(
        level=ActionLevel.PROJECT,
        url_prefix="projects",
        path_param="project_id",
        write_dependency=_project_role,
        transition_check=_owner_or(_project_write_check),
        default_owner=_project_manager_default,
    ),
]

router = APIRouter()
for _cfg in ACTION_LEVEL_CONFIGS:
    router.include_router(build_action_router(_cfg))
