"""Work Context (act-as-lower-role) — require_project_access and the widened
write gates. No Postgres: FakeDB answers db.get()/db.execute() from canned data,
same as test_authorization.py.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.deps import require_project_access
from app.models.projects import Project
from app.models.reference_data import Account
from app.schemas.enums import RoleCode
from tests.test_authorization import FakeDB, make_user, override_auth  # noqa: F401

pytestmark = pytest.mark.asyncio


# --- require_project_access (unit) -------------------------------------------


async def test_project_access_project_manager_passes_any_project():
    user = make_user()
    db = FakeDB(RoleCode.PROJECT_MANAGER)
    dep = require_project_access(RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    assert await dep(project_id=uuid4(), current_user=user, db=db) is user


async def test_project_access_admin_passes_any_project():
    user = make_user()
    db = FakeDB(RoleCode.ADMIN)
    dep = require_project_access(RoleCode.PROJECT_MANAGER, RoleCode.ADMIN)
    assert await dep(project_id=uuid4(), current_user=user, db=db) is user


async def test_project_access_rejects_role_not_in_list():
    user = make_user()
    db = FakeDB(RoleCode.TEAM_MEMBER)
    dep = require_project_access(RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(project_id=uuid4(), current_user=user, db=db)
    assert exc.value.status_code == 403


async def test_project_access_account_manager_in_scope():
    user = make_user()
    project_id, account_id = uuid4(), uuid4()
    project = SimpleNamespace(account_id=account_id, geo_id=None)
    db = FakeDB(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[account_id],
        get_map={(Project, project_id): project},
    )
    dep = require_project_access(RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    assert await dep(project_id=project_id, current_user=user, db=db) is user


async def test_project_access_account_manager_out_of_scope():
    user = make_user()
    project_id = uuid4()
    project = SimpleNamespace(account_id=uuid4(), geo_id=None)
    db = FakeDB(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[uuid4()],
        get_map={(Project, project_id): project},
    )
    dep = require_project_access(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(project_id=project_id, current_user=user, db=db)
    assert exc.value.status_code == 403


async def test_project_access_geo_head_via_project_geo():
    user = make_user()
    project_id, geo_id = uuid4(), uuid4()
    project = SimpleNamespace(account_id=None, geo_id=geo_id)
    db = FakeDB(RoleCode.GEO_HEAD, owned_geo_ids=[geo_id], get_map={(Project, project_id): project})
    dep = require_project_access(RoleCode.GEO_HEAD, RoleCode.ADMIN)
    assert await dep(project_id=project_id, current_user=user, db=db) is user


async def test_project_access_geo_head_via_account_geo_when_project_geo_null():
    user = make_user()
    project_id, account_id, geo_id = uuid4(), uuid4(), uuid4()
    project = SimpleNamespace(account_id=account_id, geo_id=None)
    account = SimpleNamespace(geo_id=geo_id)
    db = FakeDB(
        RoleCode.GEO_HEAD,
        owned_geo_ids=[geo_id],
        get_map={(Project, project_id): project, (Account, account_id): account},
    )
    dep = require_project_access(RoleCode.GEO_HEAD, RoleCode.ADMIN)
    assert await dep(project_id=project_id, current_user=user, db=db) is user


async def test_project_access_geo_head_out_of_scope():
    user = make_user()
    project_id = uuid4()
    project = SimpleNamespace(account_id=None, geo_id=uuid4())
    db = FakeDB(RoleCode.GEO_HEAD, owned_geo_ids=[uuid4()], get_map={(Project, project_id): project})
    dep = require_project_access(RoleCode.GEO_HEAD, RoleCode.ADMIN)
    with pytest.raises(HTTPException) as exc:
        await dep(project_id=project_id, current_user=user, db=db)
    assert exc.value.status_code == 403


# --- end-to-end through the widened PM-work gate ----------------------------


async def test_geo_head_may_write_project_status_for_project_in_geo(client, override_auth):
    project_id, geo_id = uuid4(), uuid4()
    project = SimpleNamespace(account_id=None, geo_id=geo_id)
    headers = override_auth(
        RoleCode.GEO_HEAD, owned_geo_ids=[geo_id], get_map={(Project, project_id): project}
    )
    response = await client.post(
        f"/api/v1/projects/{project_id}/status-reports",
        json={"period_id": str(uuid4())},
        headers=headers,
    )
    assert response.status_code != 403


async def test_geo_head_blocked_from_project_status_outside_geo(client, override_auth):
    project_id = uuid4()
    project = SimpleNamespace(account_id=None, geo_id=uuid4())
    headers = override_auth(
        RoleCode.GEO_HEAD, owned_geo_ids=[uuid4()], get_map={(Project, project_id): project}
    )
    response = await client.post(
        f"/api/v1/projects/{project_id}/status-reports",
        json={"period_id": str(uuid4())},
        headers=headers,
    )
    assert response.status_code == 403


async def test_team_member_still_blocked_from_pm_write(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(
        f"/api/v1/projects/{uuid4()}/status-reports", json={"period_id": str(uuid4())}, headers=headers
    )
    assert response.status_code == 403
