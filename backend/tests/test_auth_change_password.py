"""POST /api/v1/auth/change-password: a signed-in user rotates their own local
password. No Postgres — get_current_user and get_db are overridden and
settings.auth_type is monkeypatched, the same style as test_auth_password.py.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.main import app
from app.models.users import User

pytestmark = pytest.mark.asyncio

_CURRENT = "current-pass-123"
_NEW = "brand-new-pass-456"


class _NoopDB:
    async def flush(self):
        pass


def _make_user(password_hash: str | None) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        ldap_username="pat.lee",
        full_name="Pat Lee",
        email="pat.lee@example.com",
        role_id=uuid4(),
        is_active=True,
        password_hash=password_hash,
        mfa_enrolled=False,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def as_user(monkeypatch):
    monkeypatch.setattr(settings, "auth_type", "password")

    def _apply(user: User):
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_db] = lambda: _NoopDB()
        return {"X-API-Key": settings.api_key}

    yield _apply
    app.dependency_overrides.clear()


async def _post(client, headers, **body):
    return await client.post("/api/v1/auth/change-password", json=body, headers=headers)


async def test_change_password_succeeds_and_rehashes(client, as_user):
    user = _make_user(hash_password(_CURRENT))
    headers = as_user(user)
    resp = await _post(client, headers, current_password=_CURRENT, new_password=_NEW)
    assert resp.status_code == 204
    assert verify_password(_NEW, user.password_hash)
    assert not verify_password(_CURRENT, user.password_hash)


async def test_wrong_current_password_is_400_and_leaves_hash_untouched(client, as_user):
    user = _make_user(hash_password(_CURRENT))
    headers = as_user(user)
    resp = await _post(client, headers, current_password="wrong", new_password=_NEW)
    assert resp.status_code == 400
    assert verify_password(_CURRENT, user.password_hash)


async def test_new_password_same_as_current_is_400(client, as_user):
    user = _make_user(hash_password(_CURRENT))
    headers = as_user(user)
    resp = await _post(client, headers, current_password=_CURRENT, new_password=_CURRENT)
    assert resp.status_code == 400


async def test_new_password_below_min_length_is_422(client, as_user):
    user = _make_user(hash_password(_CURRENT))
    headers = as_user(user)
    resp = await _post(client, headers, current_password=_CURRENT, new_password="short")
    assert resp.status_code == 422


async def test_user_without_local_password_is_400(client, as_user):
    user = _make_user(None)
    headers = as_user(user)
    resp = await _post(client, headers, current_password=_CURRENT, new_password=_NEW)
    assert resp.status_code == 400


async def test_disabled_when_auth_type_is_not_password(client, as_user, monkeypatch):
    user = _make_user(hash_password(_CURRENT))
    headers = as_user(user)
    monkeypatch.setattr(settings, "auth_type", "onelogin")
    resp = await _post(client, headers, current_password=_CURRENT, new_password=_NEW)
    assert resp.status_code == 403
