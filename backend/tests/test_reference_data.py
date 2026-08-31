"""Organizations/Geos/Project Types/Accounts/Reporting Periods — all built
from build_crud_router (see factory.py): list/get stay open to any
authenticated caller, only create/update/delete are ADMIN-gated.
"""

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PREFIXES = ["organizations", "geos", "regions", "project-types", "products", "accounts", "reporting-periods"]


async def test_list_organizations_requires_auth(client):
    response = await client.get("/api/v1/organizations")
    assert response.status_code == 401


@pytest.mark.parametrize("prefix", _PREFIXES)
async def test_list_returns_200_for_any_role(client, override_auth, prefix):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/{prefix}", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.parametrize("prefix", _PREFIXES)
async def test_create_rejects_non_admin(client, override_auth, prefix):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/{prefix}", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_organization_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post("/api/v1/organizations", json={}, headers=headers)
    assert response.status_code != 403
