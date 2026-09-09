"""Reassign Owners (endpoints/reassignment.py) — role gate, Geo Head geo-scope
enforcement, and single-owner replacement. No Postgres: the same fake
AsyncSession the other dependency tests use (tests/test_authorization.py).
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.projects import Project
from app.models.reference_data import Account, Geo
from app.models.users import UserAccount, UserGeo
from app.schemas.enums import RoleCode
from tests.test_authorization import FakeDB, override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_LIST_PATHS = ("projects", "accounts", "geos")


class _RecordingDB(FakeDB):
    """FakeDB that remembers what got add()ed / delete()d, so a test can assert
    the single-owner replacement (delete every prior link row, insert one)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.added: list = []
        self.deleted: list = []

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)


def _use_db(db):
    from app.api.deps import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db


# --- Auth / role gate ----------------------------------------------------


async def test_list_routes_require_auth(client):
    for path in _LIST_PATHS:
        response = await client.get(f"/api/v1/reassignment/{path}")
        assert response.status_code == 401


async def test_list_routes_reject_non_allowed_roles(client, override_auth):
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.TEAM_MEMBER, RoleCode.PMO):
        headers = override_auth(role)
        for path in _LIST_PATHS:
            response = await client.get(f"/api/v1/reassignment/{path}", headers=headers)
            assert response.status_code == 403


async def test_list_routes_allow_geo_head_account_head_de_admin(client, override_auth):
    for role in (
        RoleCode.GEO_HEAD,
        RoleCode.ACCOUNT_MANAGER,
        RoleCode.DELIVERY_EXCELLENCE,
        RoleCode.ADMIN,
    ):
        headers = override_auth(role, owned_geo_ids=[uuid4()], owned_account_ids=[uuid4()])
        for path in _LIST_PATHS:
            response = await client.get(f"/api/v1/reassignment/{path}", headers=headers)
            assert response.status_code == 200
            assert response.json() == []


async def test_patch_routes_reject_non_allowed_roles(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    for path, body in (
        (f"projects/{uuid4()}", {"project_manager_id": str(uuid4())}),
        (f"accounts/{uuid4()}", {"user_id": str(uuid4())}),
        (f"geos/{uuid4()}", {"user_id": str(uuid4())}),
    ):
        response = await client.patch(f"/api/v1/reassignment/{path}", json=body, headers=headers)
        assert response.status_code == 403


# --- Project Manager reassignment --------------------------------------


def _fake_project(**overrides):
    defaults = dict(
        id=uuid4(),
        project_code="PRJ-1",
        project_name="Nexus Upgrade",
        account_id=None,
        geo_id=None,
        region_id=None,
        project_manager_id=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


async def test_reassign_pm_sets_project_manager(client, override_auth):
    project = _fake_project()
    new_pm = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE, get_map={(Project, project.id): project}
    )
    response = await client.patch(
        f"/api/v1/reassignment/projects/{project.id}",
        json={"project_manager_id": str(new_pm)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_manager_id == new_pm
    assert response.json()["project_manager_id"] == str(new_pm)


async def test_reassign_pm_404_when_project_missing(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    response = await client.patch(
        f"/api/v1/reassignment/projects/{uuid4()}",
        json={"project_manager_id": str(uuid4())},
        headers=headers,
    )
    assert response.status_code == 404


async def test_reassign_pm_geo_head_allowed_inside_owned_geo(client, override_auth):
    geo_id = uuid4()
    project = _fake_project(geo_id=geo_id)
    new_pm = uuid4()
    headers = override_auth(
        RoleCode.GEO_HEAD, owned_geo_ids=[geo_id], get_map={(Project, project.id): project}
    )
    response = await client.patch(
        f"/api/v1/reassignment/projects/{project.id}",
        json={"project_manager_id": str(new_pm)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_manager_id == new_pm


async def test_reassign_pm_geo_head_rejected_outside_owned_geo(client, override_auth):
    project = _fake_project(geo_id=uuid4())
    headers = override_auth(
        RoleCode.GEO_HEAD, owned_geo_ids=[uuid4()], get_map={(Project, project.id): project}
    )
    response = await client.patch(
        f"/api/v1/reassignment/projects/{project.id}",
        json={"project_manager_id": str(uuid4())},
        headers=headers,
    )
    assert response.status_code == 403


async def test_reassign_pm_geo_head_allowed_via_account_geo(client, override_auth):
    """Geo Head owns the project's account's geo even though project.geo_id is
    unset — mirrors require_project_access."""
    geo_id = uuid4()
    account_id = uuid4()
    project = _fake_project(geo_id=None, account_id=account_id)
    account = SimpleNamespace(id=account_id, name="Acme", geo_id=geo_id)
    new_pm = uuid4()
    headers = override_auth(
        RoleCode.GEO_HEAD,
        owned_geo_ids=[geo_id],
        get_map={(Project, project.id): project, (Account, account_id): account},
    )
    response = await client.patch(
        f"/api/v1/reassignment/projects/{project.id}",
        json={"project_manager_id": str(new_pm)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_manager_id == new_pm


async def test_reassign_pm_account_head_allowed_inside_owned_account(client, override_auth):
    account_id = uuid4()
    project = _fake_project(account_id=account_id)
    new_pm = uuid4()
    headers = override_auth(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[account_id],
        get_map={(Project, project.id): project},
    )
    response = await client.patch(
        f"/api/v1/reassignment/projects/{project.id}",
        json={"project_manager_id": str(new_pm)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_manager_id == new_pm


async def test_reassign_pm_account_head_rejected_outside_owned_account(client, override_auth):
    project = _fake_project(account_id=uuid4())
    headers = override_auth(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[uuid4()],
        get_map={(Project, project.id): project},
    )
    response = await client.patch(
        f"/api/v1/reassignment/projects/{project.id}",
        json={"project_manager_id": str(uuid4())},
        headers=headers,
    )
    assert response.status_code == 403


async def test_reassign_geo_head_rejected_for_account_head(client, override_auth):
    geo = SimpleNamespace(id=uuid4(), code="APAC", name="Asia Pacific")
    headers = override_auth(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[uuid4()],
        get_map={(Geo, geo.id): geo},
    )
    response = await client.patch(
        f"/api/v1/reassignment/geos/{geo.id}",
        json={"user_id": str(uuid4())},
        headers=headers,
    )
    assert response.status_code == 403


# --- Account Manager / Geo Head single-owner replacement --------------


async def test_reassign_account_manager_replaces_prior_owners(client, override_auth):
    account_id = uuid4()
    new_am = uuid4()
    account = SimpleNamespace(id=account_id, name="Acme", geo_id=None)
    prior_links = [SimpleNamespace(account_id=account_id), SimpleNamespace(account_id=account_id)]
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    db = _RecordingDB(
        RoleCode.DELIVERY_EXCELLENCE,
        owned_account_ids=prior_links,
        get_map={(Account, account_id): account},
    )
    _use_db(db)
    response = await client.patch(
        f"/api/v1/reassignment/accounts/{account_id}",
        json={"user_id": str(new_am)},
        headers=headers,
    )
    assert response.status_code == 200
    assert len(db.deleted) == 2
    assert len(db.added) == 1
    assert isinstance(db.added[0], UserAccount)
    assert db.added[0].user_id == new_am
    assert db.added[0].account_id == account_id


async def test_reassign_account_manager_geo_head_scope(client, override_auth):
    geo_id = uuid4()
    in_geo = SimpleNamespace(id=uuid4(), name="Acme", geo_id=geo_id)
    out_geo = SimpleNamespace(id=uuid4(), name="Globex", geo_id=uuid4())
    headers = override_auth(
        RoleCode.GEO_HEAD,
        owned_geo_ids=[geo_id],
        get_map={(Account, in_geo.id): in_geo, (Account, out_geo.id): out_geo},
    )
    ok = await client.patch(
        f"/api/v1/reassignment/accounts/{in_geo.id}",
        json={"user_id": str(uuid4())},
        headers=headers,
    )
    assert ok.status_code == 200
    denied = await client.patch(
        f"/api/v1/reassignment/accounts/{out_geo.id}",
        json={"user_id": str(uuid4())},
        headers=headers,
    )
    assert denied.status_code == 403


async def test_reassign_account_manager_account_head_scope(client, override_auth):
    owned = SimpleNamespace(id=uuid4(), name="Acme", geo_id=None)
    other = SimpleNamespace(id=uuid4(), name="Globex", geo_id=None)
    headers = override_auth(
        RoleCode.ACCOUNT_MANAGER,
        owned_account_ids=[owned.id],
        get_map={(Account, owned.id): owned, (Account, other.id): other},
    )
    ok = await client.patch(
        f"/api/v1/reassignment/accounts/{owned.id}",
        json={"user_id": str(uuid4())},
        headers=headers,
    )
    assert ok.status_code == 200
    denied = await client.patch(
        f"/api/v1/reassignment/accounts/{other.id}",
        json={"user_id": str(uuid4())},
        headers=headers,
    )
    assert denied.status_code == 403


async def test_reassign_geo_head_replaces_prior_owners(client, override_auth):
    geo_id = uuid4()
    new_head = uuid4()
    geo = SimpleNamespace(id=geo_id, code="APAC", name="Asia Pacific")
    prior_links = [SimpleNamespace(geo_id=geo_id)]
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    db = _RecordingDB(
        RoleCode.DELIVERY_EXCELLENCE,
        owned_geo_ids=prior_links,
        get_map={(Geo, geo_id): geo},
    )
    _use_db(db)
    response = await client.patch(
        f"/api/v1/reassignment/geos/{geo_id}",
        json={"user_id": str(new_head)},
        headers=headers,
    )
    assert response.status_code == 200
    assert len(db.deleted) == 1
    assert len(db.added) == 1
    assert isinstance(db.added[0], UserGeo)
    assert db.added[0].user_id == new_head
    assert db.added[0].geo_id == geo_id


async def test_reassign_geo_head_geo_head_scope(client, override_auth):
    owned = uuid4()
    in_scope = SimpleNamespace(id=owned, code="APAC", name="Asia Pacific")
    out_scope = SimpleNamespace(id=uuid4(), code="MEA", name="Middle East")
    headers = override_auth(
        RoleCode.GEO_HEAD,
        owned_geo_ids=[owned],
        get_map={(Geo, in_scope.id): in_scope, (Geo, out_scope.id): out_scope},
    )
    denied = await client.patch(
        f"/api/v1/reassignment/geos/{out_scope.id}",
        json={"user_id": str(uuid4())},
        headers=headers,
    )
    assert denied.status_code == 403
