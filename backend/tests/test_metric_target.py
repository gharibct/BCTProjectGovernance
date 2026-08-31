"""Metric Targets are a get-or-404 / upsert pair keyed by project_id (no list
endpoint — see metric_target.py's module docstring), so unlike the other
modules here the "happy path" for an authenticated caller is a clean 404
(no target set yet) rather than a 200 with an empty page.
"""

from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_get_development_target_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development")
    assert response.status_code == 401


async def test_get_development_target_404s_for_any_role_when_unset(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development", headers=headers)
    assert response.status_code == 404


async def test_upsert_development_target_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development", json={}, headers=headers
    )
    assert response.status_code == 403


async def test_upsert_development_target_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development", json={}, headers=headers
    )
    assert response.status_code != 403


async def test_get_staffing_target_404s_for_any_role_when_unset(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/metric-targets/staffing", headers=headers)
    assert response.status_code == 404
