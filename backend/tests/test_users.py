"""users.py — the whole /users sub-router (including list/get) is wrapped in
an admin-only dependency at include_router() time (unlike the other
build_crud_router mounts, which only gate writes), plus a few hand-written
/roles and /users/{id}/accounts|geos endpoints on the same admin-only gate.
test_authorization.py already covers the accounts/geos endpoints end-to-end;
this file covers the plain list endpoints those didn't touch.
"""

from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_list_users_requires_auth(client):
    response = await client.get("/api/v1/users")
    assert response.status_code == 401


async def test_list_users_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/users", headers=headers)
    assert response.status_code == 403


async def test_list_users_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get("/api/v1/users", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_list_roles_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/roles", headers=headers)
    assert response.status_code == 403


async def test_list_roles_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get("/api/v1/roles", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_user_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post("/api/v1/users", json={}, headers=headers)
    assert response.status_code == 403


async def test_get_user_not_found_returns_404_for_admin(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get(f"/api/v1/users/{uuid4()}", headers=headers)
    assert response.status_code == 404
