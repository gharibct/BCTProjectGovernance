from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_list_checklist_items_requires_auth(client):
    response = await client.get("/api/v1/data-integrity-checklist-items")
    assert response.status_code == 401


async def test_list_checklist_items_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/data-integrity-checklist-items", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_create_checklist_item_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post("/api/v1/data-integrity-checklist-items", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_checklist_item_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post("/api/v1/data-integrity-checklist-items", json={}, headers=headers)
    assert response.status_code != 403


async def test_project_data_integrity_status_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{uuid4()}/data-integrity-status", headers=headers)
    assert response.status_code == 200
    assert response.json() == []
