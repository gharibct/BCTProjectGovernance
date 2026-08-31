"""Unit tests for the role/scope dependencies in app.api.deps. No Postgres
needed (see test_health.py's module docstring) — these call the dependency
functions directly against a fake AsyncSession that answers db.get()/
db.execute() from canned data, the same shape the real endpoints see.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.deps import (
    require_account_geo_scope,
    require_account_scope,
    require_geo_scope,
    require_project_account_scope,
    require_role,
)
from app.models.projects import Project
from app.models.reference_data import Account
from app.models.users import Role
from app.schemas.enums import RoleCode

pytestmark = pytest.mark.asyncio


class _ScalarsResult:
    def __init__(self, values):
        self._values = values

    def all(self):
        return self._values


class _ExecResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return _ScalarsResult(self._values)

    def scalar_one(self):
        return len(self._values)

    def scalar_one_or_none(self):
        return self._values[0] if self._values else None

    def all(self):
        return self._values

    def one(self):
        return self._values[0]


class FakeDB:
    """Answers db.get(Role, ...) with a canned role, db.get(Project/Account, ...)
    from get_map, and db.execute(select(UserAccount.account_id)/UserGeo.geo_id))
    with the caller's owned ids — enough surface for every dependency in deps.py."""

    def __init__(self, role_code, owned_account_ids=(), owned_geo_ids=(), get_map=None):
        self._role = Role(id=uuid4(), code=role_code, name=role_code) if role_code else None
        self._owned_account_ids = list(owned_account_ids)
        self._owned_geo_ids = list(owned_geo_ids)
        self._get_map = get_map or {}

    async def get(self, model, pk):
        if model is Role:
            return self._role
        return self._get_map.get((model, pk))

    async def execute(self, stmt):
        compiled = str(stmt)
        if "user_accounts" in compiled:
            return _ExecResult(self._owned_account_ids)
        if "user_geos" in compiled:
            return _ExecResult(self._owned_geo_ids)
        return _ExecResult([])

    # No-op write surface — endpoint tests that get past a role/scope gate
    # (see override_auth below) still run the real endpoint body, which for
    # create/update/delete calls these. FakeDB has no real storage, so these
    # just let the call complete instead of raising AttributeError; the
    # object handed to add()/refresh() is left as whatever the endpoint
    # already constructed in memory.
    def add(self, obj):
        pass

    def add_all(self, objs):
        pass

    async def flush(self):
        pass

    async def refresh(self, obj):
        pass

    async def delete(self, obj):
        pass

    async def commit(self):
        pass

    async def rollback(self):
        pass


def make_user():
    return SimpleNamespace(id=uuid4(), role_id=uuid4())


async def test_require_role_allows_matching_role():
    user = make_user()
    db = FakeDB(RoleCode.ADMIN)
    dep = require_role(RoleCode.ADMIN)
    assert await dep(current_user=user, db=db) is user


async def test_require_role_rejects_other_role():
    user = make_user()
    db = FakeDB(RoleCode.TEAM_MEMBER)
    dep = require_role(RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(current_user=user, db=db)
    assert exc.value.status_code == 403


async def test_require_account_scope_allows_owned_account():
    user = make_user()
    account_id = uuid4()
    db = FakeDB(RoleCode.ACCOUNT_MANAGER, owned_account_ids=[account_id])
    dep = require_account_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    assert await dep(account_id=account_id, current_user=user, db=db) is user


async def test_require_account_scope_rejects_unowned_account():
    user = make_user()
    db = FakeDB(RoleCode.ACCOUNT_MANAGER, owned_account_ids=[uuid4()])
    dep = require_account_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(account_id=uuid4(), current_user=user, db=db)
    assert exc.value.status_code == 403


async def test_require_account_scope_admin_bypasses_ownership():
    user = make_user()
    db = FakeDB(RoleCode.ADMIN, owned_account_ids=[])
    dep = require_account_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    assert await dep(account_id=uuid4(), current_user=user, db=db) is user


async def test_require_account_scope_rejects_wrong_role_even_if_owned():
    user = make_user()
    account_id = uuid4()
    db = FakeDB(RoleCode.TEAM_MEMBER, owned_account_ids=[account_id])
    dep = require_account_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(account_id=account_id, current_user=user, db=db)
    assert exc.value.status_code == 403


async def test_require_geo_scope_allows_owned_geo():
    user = make_user()
    geo_id = uuid4()
    db = FakeDB(RoleCode.GEO_HEAD, owned_geo_ids=[geo_id])
    dep = require_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN)
    assert await dep(geo_id=geo_id, current_user=user, db=db) is user


async def test_require_geo_scope_rejects_unowned_geo():
    user = make_user()
    db = FakeDB(RoleCode.GEO_HEAD, owned_geo_ids=[uuid4()])
    dep = require_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(geo_id=uuid4(), current_user=user, db=db)
    assert exc.value.status_code == 403


async def test_require_project_account_scope_allows_when_project_in_owned_account():
    user = make_user()
    project_id = uuid4()
    account_id = uuid4()
    project = SimpleNamespace(account_id=account_id)
    db = FakeDB(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[account_id],
        get_map={(Project, project_id): project},
    )
    dep = require_project_account_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    assert await dep(project_id=project_id, current_user=user, db=db) is user


async def test_require_project_account_scope_rejects_when_project_in_other_account():
    user = make_user()
    project_id = uuid4()
    project = SimpleNamespace(account_id=uuid4())
    db = FakeDB(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[uuid4()],
        get_map={(Project, project_id): project},
    )
    dep = require_project_account_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(project_id=project_id, current_user=user, db=db)
    assert exc.value.status_code == 403


async def test_require_account_geo_scope_allows_when_account_in_owned_geo():
    user = make_user()
    account_id = uuid4()
    geo_id = uuid4()
    account = SimpleNamespace(geo_id=geo_id)
    db = FakeDB(
        RoleCode.GEO_HEAD,
        owned_geo_ids=[geo_id],
        get_map={(Account, account_id): account},
    )
    dep = require_account_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN)
    assert await dep(account_id=account_id, current_user=user, db=db) is user


async def test_require_account_geo_scope_rejects_when_account_in_other_geo():
    user = make_user()
    account_id = uuid4()
    account = SimpleNamespace(geo_id=uuid4())
    db = FakeDB(
        RoleCode.GEO_HEAD,
        owned_geo_ids=[uuid4()],
        get_map={(Account, account_id): account},
    )
    dep = require_account_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(account_id=account_id, current_user=user, db=db)
    assert exc.value.status_code == 403


# --- End-to-end (through the real app, DB layer swapped for FakeDB via
# dependency_overrides) --- confirms the wiring in main.py/users.py/
# reference_data.py, not just the dependency functions in isolation.


@pytest.fixture
def override_auth():
    """Patches get_current_user/get_db app-wide for the duration of a test —
    every require_role/require_*_scope dependency call sites use these two
    symbols internally, so overriding them here covers all of them."""

    from app.api.deps import get_current_user, get_db
    from app.core.config import settings
    from app.main import app

    def _apply(role_code, **fake_db_kwargs):
        user = make_user()
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_db] = lambda: FakeDB(role_code, **fake_db_kwargs)
        return {"X-API-Key": settings.api_key}

    yield _apply
    app.dependency_overrides.clear()


async def test_admin_only_endpoint_rejects_non_admin_session(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.put(f"/api/v1/users/{uuid4()}/accounts", json={"account_ids": []}, headers=headers)
    assert response.status_code == 403


async def test_admin_only_endpoint_passes_admin_session(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get(f"/api/v1/users/{uuid4()}/accounts", headers=headers)
    assert response.status_code == 200


async def test_read_only_endpoint_still_works_for_non_admin_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/geos", headers=headers)
    assert response.status_code == 200
