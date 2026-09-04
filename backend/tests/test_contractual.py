from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_list_commitments_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/contractual-commitments")
    assert response.status_code == 401


async def test_list_commitments_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/contractual-commitments", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_commitment_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/contractual-commitments", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_commitment_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/contractual-commitments", json={}, headers=headers)
    assert response.status_code != 403


_COMMITMENT_ID = uuid4()
_ACTUAL_ID = uuid4()
_ACTUALS_URL = f"/api/v1/projects/{_PROJECT_ID}/contractual-commitments/{_COMMITMENT_ID}/actuals"


async def test_list_commitment_actuals_requires_auth(client):
    response = await client.get(_ACTUALS_URL)
    assert response.status_code == 401


async def test_create_commitment_actual_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(_ACTUALS_URL, json={"period_date": "2026-01-31"}, headers=headers)
    assert response.status_code == 403


async def test_create_commitment_actual_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(_ACTUALS_URL, json={"period_date": "2026-01-31"}, headers=headers)
    assert response.status_code != 403


async def test_update_commitment_actual_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.put(f"{_ACTUALS_URL}/{_ACTUAL_ID}", json={}, headers=headers)
    assert response.status_code == 403


async def test_update_commitment_actual_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(f"{_ACTUALS_URL}/{_ACTUAL_ID}", json={}, headers=headers)
    assert response.status_code != 403


async def test_delete_commitment_actual_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.delete(f"{_ACTUALS_URL}/{_ACTUAL_ID}", headers=headers)
    assert response.status_code == 403


async def test_delete_commitment_actual_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.delete(f"{_ACTUALS_URL}/{_ACTUAL_ID}", headers=headers)
    assert response.status_code != 403


async def test_list_milestones_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/milestone-payments")
    assert response.status_code == 401


async def test_list_milestones_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/milestone-payments", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_milestone_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/milestone-payments", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_milestone_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/milestone-payments", json={}, headers=headers)
    assert response.status_code != 403
