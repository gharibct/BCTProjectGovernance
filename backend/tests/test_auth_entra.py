"""Entra claim -> app user resolution (resolve_entra_user). No Postgres and no
real OIDC round-trip: the DB is a scripted fake and claims are passed directly,
the same style as test_auth_change_password.py.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.auth import resolve_entra_user
from app.core.config import settings
from app.models.users import User

pytestmark = pytest.mark.asyncio

_TENANT = "11111111-1111-1111-1111-111111111111"
_OID = "22222222-2222-2222-2222-222222222222"


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _FakeDB:
    """Returns the scripted result sets in order: oid lookup, then email lookup."""

    def __init__(self, *result_sets):
        self._sets = list(result_sets)
        self.flushed = False

    async def execute(self, _stmt):
        return _Result(self._sets.pop(0))

    async def flush(self):
        self.flushed = True


def _user(*, active=True, entra_oid=None) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        ldap_username="pat.lee",
        full_name="Pat Lee",
        email="pat.lee@example.com",
        role_id=uuid4(),
        is_active=active,
        entra_oid=entra_oid,
        mfa_enrolled=False,
        created_at=now,
        updated_at=now,
    )


def _claims(**over):
    return {"tid": _TENANT, "oid": _OID, "preferred_username": "Pat.Lee@example.com", **over}


@pytest.fixture(autouse=True)
def _tenant(monkeypatch):
    monkeypatch.setattr(settings, "entra_tenant_id", _TENANT)


async def test_matches_by_oid():
    user = _user(entra_oid=_OID)
    db = _FakeDB([user])
    assert await resolve_entra_user(db, _claims()) is user
    assert user.last_login_at is not None


async def test_email_fallback_binds_oid():
    user = _user()
    db = _FakeDB([], [user])
    assert await resolve_entra_user(db, _claims()) is user
    assert user.entra_oid == _OID


async def test_wrong_tenant_rejected():
    with pytest.raises(HTTPException) as exc:
        await resolve_entra_user(_FakeDB(), _claims(tid="other-tenant"))
    assert exc.value.status_code == 403


async def test_unknown_user_rejected():
    with pytest.raises(HTTPException) as exc:
        await resolve_entra_user(_FakeDB([], []), _claims())
    assert exc.value.status_code == 403


async def test_inactive_user_rejected_and_not_bound():
    user = _user(active=False)
    with pytest.raises(HTTPException) as exc:
        await resolve_entra_user(_FakeDB([], [user]), _claims())
    assert exc.value.status_code == 403
    assert user.entra_oid is None


async def test_email_match_bound_to_other_oid_rejected():
    user = _user(entra_oid="99999999-9999-9999-9999-999999999999")
    with pytest.raises(HTTPException) as exc:
        await resolve_entra_user(_FakeDB([], [user]), _claims())
    assert exc.value.status_code == 403


async def test_missing_oid_rejected():
    with pytest.raises(HTTPException) as exc:
        await resolve_entra_user(_FakeDB(), _claims(oid=""))
    assert exc.value.status_code == 400
