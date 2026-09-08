"""In-app notifications — the /notifications endpoints (through the real app
with the DB layer swapped for FakeDB) plus the notify() write path and the
time-based scan functions (against a throwaway sqlite DB)."""

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.actions import Action
from app.models.notification import Notification
from app.schemas.enums import ActionStatus, RoleCode
from app.services import notification_scans, notifications as notify_svc
from tests.test_authorization import override_auth  # noqa: F401 — fixture

pytestmark = pytest.mark.asyncio


# --- Endpoints -------------------------------------------------------------


async def test_list_requires_auth(client):
    resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 401


async def test_unread_count_requires_auth(client):
    resp = await client.get("/api/v1/notifications/unread-count")
    assert resp.status_code == 401


@pytest.mark.parametrize("role", [RoleCode.PROJECT_MANAGER, RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN])
async def test_list_returns_page_shape(client, override_auth, role):
    headers = override_auth(role)
    resp = await client.get("/api/v1/notifications?skip=0&limit=10", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"items": [], "total": 0, "skip": 0, "limit": 10}


async def test_list_accepts_unread_only(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    resp = await client.get("/api/v1/notifications?unread_only=true", headers=headers)
    assert resp.status_code == 200


async def test_unread_count_shape(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    resp = await client.get("/api/v1/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"unread": 0}


async def test_mark_read_404_when_not_mine(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    resp = await client.post(f"/api/v1/notifications/{uuid4()}/read", headers=headers)
    assert resp.status_code == 404


async def test_mark_all_read_returns_204(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    resp = await client.post("/api/v1/notifications/read-all", headers=headers)
    assert resp.status_code == 204


# --- notify() + scans against a real (throwaway sqlite) session -----------


@pytest.fixture
async def session_factory(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'notifications_test.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


async def test_notify_creates_one_row(session_factory):
    async with session_factory() as db:
        recipient = uuid4()
        row = await notify_svc.notify(
            db, recipient_id=recipient, type="ACTION_ASSIGNED", title="hi", link="/x"
        )
        await db.commit()
        assert row is not None
        rows = (await db.execute(select(Notification).where(Notification.recipient_id == recipient))).scalars().all()
        assert len(rows) == 1


async def test_notify_skips_self_notification(session_factory):
    async with session_factory() as db:
        me = uuid4()
        row = await notify_svc.notify(db, recipient_id=me, type="X", title="t", actor_id=me)
        assert row is None


async def test_notify_dedupe_key_is_idempotent(session_factory):
    async with session_factory() as db:
        recipient = uuid4()
        kwargs = dict(type="ACTION_DUE", title="due", dedupe_key="action-due:abc:2026-09-08")
        first = await notify_svc.notify(db, recipient_id=recipient, **kwargs)
        await db.commit()
        second = await notify_svc.notify(db, recipient_id=recipient, **kwargs)
        await db.commit()
        assert first is not None
        assert second is None
        rows = (await db.execute(select(Notification).where(Notification.recipient_id == recipient))).scalars().all()
        assert len(rows) == 1


async def test_unread_count_helper(session_factory):
    async with session_factory() as db:
        recipient = uuid4()
        await notify_svc.notify(db, recipient_id=recipient, type="X", title="a")
        await notify_svc.notify(db, recipient_id=recipient, type="X", title="b")
        await db.commit()
        assert await notify_svc.unread_count(db, recipient) == 2


async def _make_action(db, *, assignee, due_date, status=ActionStatus.OPEN, code=None):
    now = datetime.now(UTC)
    action = Action(
        id=uuid4(),
        action_code=code or f"ACT-{uuid4().hex[:8]}",
        level="PROJECT",
        level_value=str(uuid4()),
        title="Do the thing",
        description=None,
        action_by_id=assignee,
        priority="High",
        status=status,
        due_date=due_date,
        raised_by=assignee,
        raised_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(action)
    await db.commit()
    return action


async def test_scan_actions_due_notifies_assignee_and_dedupes(session_factory):
    async with session_factory() as db:
        assignee = uuid4()
        await _make_action(db, assignee=assignee, due_date=date.today() - timedelta(days=1))  # overdue
        await _make_action(db, assignee=assignee, due_date=date.today() + timedelta(days=1))  # due soon
        await _make_action(db, assignee=assignee, due_date=date.today() + timedelta(days=30))  # not yet

        created = await notification_scans.scan_actions_due(db)
        await db.commit()
        assert created == 2

        again = await notification_scans.scan_actions_due(db)
        await db.commit()
        assert again == 0  # dedupe_key blocks the repeat

        rows = (await db.execute(select(Notification).where(Notification.recipient_id == assignee))).scalars().all()
        assert len(rows) == 2
        assert {r.type for r in rows} == {"ACTION_DUE"}
