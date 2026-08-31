import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_dashboard_summary_requires_auth(client):
    response = await client.get("/api/v1/dashboard/summary")
    assert response.status_code == 401


async def test_dashboard_summary_returns_200_for_any_role(client, override_auth):
    # Read-only aggregation over every other module — no write endpoints, so
    # no role-gate test needed. FakeDB has no seeded rows, so every count/list
    # in the summary comes back empty/zero.
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/dashboard/summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["active_projects"] == 0
    assert body["open_risks"] == 0
    assert body["project_health"] == []
    assert body["account_health"] == []


async def test_pmo_summary_requires_auth(client):
    response = await client.get("/api/v1/dashboard/pmo-summary")
    assert response.status_code == 401


async def test_pmo_summary_rejects_non_pmo_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/dashboard/pmo-summary", headers=headers)
    assert response.status_code == 403


async def test_pmo_summary_returns_200_for_pmo_role(client, override_auth):
    # No PMO login exists yet, but the endpoint itself is real (org-wide,
    # no owned-scope filter) — an empty DB should come back with every
    # count/list at zero rather than erroring.
    headers = override_auth(RoleCode.PMO)
    response = await client.get("/api/v1/dashboard/pmo-summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["active_projects_count"] == 0
    assert body["governance_compliance_pct"] == 0
    assert body["governance_exceptions"] == []
    assert body["governance_compliance"] == []
    assert body["reporting_compliance"] == {
        "on_time_count": 0,
        "late_count": 0,
        "missing_count": 0,
        "rework_count": 0,
    }
