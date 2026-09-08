"""AUTH_TYPE=password: POST /api/v1/auth/login must verify a local scrypt
password, and the scrypt helpers in app.core.security must round-trip. No
Postgres — get_db is overridden with a tiny canned-user fake (login has no
session gate, only the API key), and settings.auth_type is monkeypatched.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.core.config import settings
from app.core.db import get_db
from app.core.security import hash_password
from app.main import app
from app.models.users import Role, User

pytestmark = pytest.mark.asyncio

_PASSWORD = "correct horse battery"


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _LoginDB:
    """Answers the three queries POST /auth/login + _build_session_read run:
    the User lookup, db.get(Role, ...), and the user_geos / user_accounts id
    selects."""

    def __init__(self, user: User | None, role: Role):
        self._user = user
        self._role = role

    async def get(self, model, pk):
        return self._role if model is Role else None

    async def execute(self, stmt):
        compiled = str(stmt)
        if "FROM users" in compiled:
            return _ScalarResult([self._user] if self._user else [])
        return _ScalarResult([])  # user_geos / user_accounts


def _make_user(password_hash: str | None, *, is_active: bool = True) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        ldap_username="pat.lee",
        full_name="Pat Lee",
        email="pat.lee@example.com",
        role_id=uuid4(),
        is_active=is_active,
        password_hash=password_hash,
        mfa_enrolled=False,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def password_mode(monkeypatch):
    monkeypatch.setattr(settings, "auth_type", "password")

    def _use(user: User | None):
        role = Role(id=user.role_id if user else uuid4(), code="ADMIN", name="Admin", description=None)
        app.dependency_overrides[get_db] = lambda: _LoginDB(user, role)

    yield _use
    app.dependency_overrides.pop(get_db, None)


def _headers():
    return {"X-API-Key": settings.api_key}


async def test_correct_password_succeeds(client, password_mode):
    password_mode(_make_user(hash_password(_PASSWORD)))
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pat.lee@example.com", "password": _PASSWORD},
        headers=_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "pat.lee@example.com"
    assert "pg_session" in resp.cookies


async def test_wrong_password_is_401(client, password_mode):
    password_mode(_make_user(hash_password(_PASSWORD)))
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pat.lee@example.com", "password": "nope"},
        headers=_headers(),
    )
    assert resp.status_code == 401


async def test_missing_password_is_401(client, password_mode):
    password_mode(_make_user(hash_password(_PASSWORD)))
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pat.lee@example.com"},
        headers=_headers(),
    )
    assert resp.status_code == 401


async def test_user_without_local_password_is_401(client, password_mode):
    password_mode(_make_user(None))
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pat.lee@example.com", "password": _PASSWORD},
        headers=_headers(),
    )
    assert resp.status_code == 401


async def test_unknown_identifier_is_401_not_404(client, password_mode):
    password_mode(None)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "ghost@example.com", "password": _PASSWORD},
        headers=_headers(),
    )
    # 401 (not 404) so the response can't be used to enumerate accounts.
    assert resp.status_code == 401


async def test_no_password_mode_still_ignores_password(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_type", "no_password")
    user = _make_user(None)
    role = Role(id=user.role_id, code="ADMIN", name="Admin", description=None)
    app.dependency_overrides[get_db] = lambda: _LoginDB(user, role)
    try:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"identifier": "pat.lee@example.com"},
            headers=_headers(),
        )
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_db, None)
