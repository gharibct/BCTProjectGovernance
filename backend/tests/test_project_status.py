from uuid import uuid4

import pytest

from app.schemas.enums import ProjectStatusCategory, RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_list_status_reports_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/status-reports")
    assert response.status_code == 401


async def test_list_status_reports_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/status-reports", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_status_report_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/status-reports", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_status_report_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/status-reports", json={}, headers=headers)
    assert response.status_code != 403


async def test_review_status_report_rejects_wrong_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
    )
    assert response.status_code == 403


async def test_review_status_report_passes_account_manager_or_admin_gate(client, override_auth):
    # ADMIN bypasses require_project_account_scope's ownership check entirely
    # (see app.api.deps.require_project_account_scope), so no FakeDB
    # get_map/owned_account_ids setup is needed here.
    headers = override_auth(RoleCode.ADMIN)
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
    )
    assert response.status_code != 403


async def test_list_status_items_returns_200(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(
        f"/api/v1/projects/{_PROJECT_ID}/status-items",
        params={"period_id": str(uuid4()), "category": ProjectStatusCategory.KEY_ACCOMPLISHMENTS.value},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json() == []
