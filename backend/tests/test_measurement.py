"""Measurement Entry: 4 flat tabs off build_measurement_router (support,
testing, cloud-maintenance, cloud-migration) plus bespoke Development and
Staffing routers with their own nested child rows.
"""

from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_list_support_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/measurements/support")
    assert response.status_code == 401


async def test_list_support_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/measurements/support", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_create_support_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/measurements/support", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_support_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/measurements/support", json={}, headers=headers)
    assert response.status_code != 403


# GET-only smoke test for the remaining flat tabs + the two bespoke routers —
# confirms build_measurement_router's per-tab wiring and the hand-rolled
# development/staffing routers all resolve.
@pytest.mark.parametrize("prefix", ["testing", "cloud-maintenance", "cloud-migration", "development", "staffing"])
async def test_list_other_measurement_tabs_smoke(client, override_auth, prefix):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/measurements/{prefix}", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()
