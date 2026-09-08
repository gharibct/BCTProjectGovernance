"""The one write path for in-app notifications, plus recipient resolvers.

`notify()` inserts a row on the caller's session; `get_db`'s single
post-request commit persists it atomically with the domain change (same
pattern as de_findings.record_finding_history / actions._add_history). For
periodic scans, pass a `dedupe_key` so a repeated scan is a no-op.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.users import Role, User, UserAccount, UserGeo
from app.schemas.enums import RoleCode


async def _dedupe_exists(db: AsyncSession, recipient_id: UUID, dedupe_key: str) -> bool:
    row = await db.execute(
        select(Notification.id).where(
            Notification.recipient_id == recipient_id,
            Notification.dedupe_key == dedupe_key,
        )
    )
    return row.scalar_one_or_none() is not None


async def notify(
    db: AsyncSession,
    *,
    recipient_id: UUID | None,
    type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    data: dict | None = None,
    actor_id: UUID | None = None,
    dedupe_key: str | None = None,
) -> Notification | None:
    """Create one notification. No-ops (returns None) when there is no
    recipient, the recipient is the actor, or a row with the same
    (recipient, dedupe_key) already exists."""
    if recipient_id is None or (actor_id is not None and recipient_id == actor_id):
        return None
    if dedupe_key and await _dedupe_exists(db, recipient_id, dedupe_key):
        return None
    obj = Notification(
        id=uuid4(),
        recipient_id=recipient_id,
        type=type,
        title=title,
        body=body,
        link=link,
        entity_type=entity_type,
        entity_id=entity_id,
        data=data,
        actor_id=actor_id,
        dedupe_key=dedupe_key,
        created_at=datetime.now(UTC),
    )
    db.add(obj)
    await db.flush()
    return obj


async def notify_many(
    db: AsyncSession, recipient_ids: list[UUID | None], **kwargs
) -> list[Notification]:
    seen: set[UUID] = set()
    out: list[Notification] = []
    for rid in recipient_ids:
        if rid is None or rid in seen:
            continue
        seen.add(rid)
        created = await notify(db, recipient_id=rid, **kwargs)
        if created is not None:
            out.append(created)
    return out


# --- Recipient resolvers (same query shapes as users.py::get_account_head /
#     get_geo_head — "the earliest-created user in role R mapped to scope S").


async def _first_user_in_role_for_scope(
    db: AsyncSession, role_code: RoleCode, link_model: type, link_fk, scope_id: UUID
) -> UUID | None:
    role_id = (
        await db.execute(select(Role.id).where(Role.code == role_code))
    ).scalar_one_or_none()
    if role_id is None:
        return None
    return (
        await db.execute(
            select(User.id)
            .join(link_model, link_model.user_id == User.id)
            .where(link_fk == scope_id, User.role_id == role_id)
            .order_by(User.created_at)
            .limit(1)
        )
    ).scalars().first()


async def account_head_id(db: AsyncSession, account_id: UUID | None) -> UUID | None:
    if account_id is None:
        return None
    return await _first_user_in_role_for_scope(
        db, RoleCode.ACCOUNT_MANAGER, UserAccount, UserAccount.account_id, account_id
    )


async def geo_head_id(db: AsyncSession, geo_id: UUID | None) -> UUID | None:
    if geo_id is None:
        return None
    return await _first_user_in_role_for_scope(
        db, RoleCode.GEO_HEAD, UserGeo, UserGeo.geo_id, geo_id
    )


async def users_in_role(db: AsyncSession, role_code: RoleCode) -> list[UUID]:
    role_id = (
        await db.execute(select(Role.id).where(Role.code == role_code))
    ).scalar_one_or_none()
    if role_id is None:
        return []
    return list(
        (
            await db.execute(
                select(User.id).where(User.role_id == role_id, User.is_active.is_(True))
            )
        ).scalars().all()
    )


async def unread_count(db: AsyncSession, recipient_id: UUID) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(Notification)
            .where(Notification.recipient_id == recipient_id, Notification.read_at.is_(None))
        )
    ).scalar_one()
