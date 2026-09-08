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


async def test_list_projects_accepts_exclude_status(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    response = await client.get(
        "/api/v1/projects",
        params=[("exclude_status", "Draft"), ("exclude_status", "Approved")],
        headers=headers,
    )
    assert response.status_code == 200
    assert "items" in response.json()


async def test_list_projects_accepts_geo_account_search_filters(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(
        "/api/v1/projects",
        params={"geo_id": str(uuid4()), "account_id": str(uuid4()), "search": "erp"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    # FakeDB seeds nothing — this just locks in that geo_id / account_id / search
    # are wired through the endpoint signature without erroring.
    assert body["items"] == []
    assert body["total"] == 0
    assert {"items", "total", "skip", "limit"} <= body.keys()


async def test_list_projects_search_combines_with_exclude_status(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    response = await client.get(
        "/api/v1/projects",
        params=[("exclude_status", "Draft"), ("search", "cloud")],
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["items"] == []


async def test_list_projects_rejects_non_uuid_geo_id(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(
        "/api/v1/projects", params={"geo_id": "not-a-uuid"}, headers=headers
    )
    assert response.status_code == 422


# Direct POST /projects is now Admin-only — the user-facing create flow goes
# through /project-creation-requests (Account/Geo Head submits, DE approves).
async def test_create_project_rejects_non_admin(client, override_auth):
    for role in (RoleCode.TEAM_MEMBER, RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER):
        headers = override_auth(role)
        response = await client.post("/api/v1/projects", json={}, headers=headers)
        assert response.status_code == 403


async def test_create_project_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post("/api/v1/projects", json={}, headers=headers)
    assert response.status_code != 403


async def test_get_project_not_found_returns_404_not_403(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{uuid4()}", headers=headers)
    assert response.status_code == 404
