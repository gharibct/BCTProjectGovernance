from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_list_projects_requires_auth(client):
    response = await client.get("/api/v1/projects")
    assert response.status_code == 401


async def test_list_projects_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/projects", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_create_project_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post("/api/v1/projects", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_project_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post("/api/v1/projects", json={}, headers=headers)
    assert response.status_code != 403


async def test_get_project_not_found_returns_404_not_403(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{uuid4()}", headers=headers)
    assert response.status_code == 404
