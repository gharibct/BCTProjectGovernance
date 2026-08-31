from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_list_risks_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/risks")
    assert response.status_code == 401


async def test_list_risks_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/risks", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_create_risk_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/risks", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_risk_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/risks", json={}, headers=headers)
    assert response.status_code != 403


# One GET-only smoke test per remaining RAID type — build_raid_router is a
# single parametrized factory (see raid.py), so this is the one place a
# wiring bug (e.g. a bad prefix/field name in one RaidConfig) could silently
# break just one of the five types.
@pytest.mark.parametrize("prefix", ["issues", "dependencies", "assumptions", "opportunities"])
async def test_list_raid_type_smoke(client, override_auth, prefix):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/{prefix}", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()
