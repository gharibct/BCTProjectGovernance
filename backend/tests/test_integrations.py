import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_list_integrations_requires_auth(client):
    response = await client.get("/api/v1/integrations")
    assert response.status_code == 401


async def test_list_integrations_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/integrations", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_create_integration_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post("/api/v1/integrations", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_integration_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post("/api/v1/integrations", json={}, headers=headers)
    assert response.status_code != 403


async def test_list_backup_restore_log_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/backup-restore-log", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_trigger_backup_restore_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post("/api/v1/backup-restore-log", json={}, headers=headers)
    assert response.status_code == 403
