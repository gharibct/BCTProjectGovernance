from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.schemas.enums import HealthRating, RoleCode
from app.services import dashboard as dashboard_service
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_health_split_gives_potential_red_its_own_bucket():
    rows = [
        SimpleNamespace(overall_rating=HealthRating.GREEN),
        SimpleNamespace(overall_rating=HealthRating.AMBER),
        SimpleNamespace(overall_rating=HealthRating.POTENTIAL_RED),
        SimpleNamespace(overall_rating=HealthRating.RED),
        SimpleNamespace(overall_rating=None),
    ]
    green, amber, potential_red, red = dashboard_service.health_split(rows)
    assert (green, amber, potential_red, red) == (1, 1, 1, 1)
    # Potential Red must not be folded into the red count.
    assert red == 1


async def test_account_portfolio_health_separates_potential_red():
    account_id = uuid4()
    project_matrix = [
        SimpleNamespace(account_id=account_id, overall_rating=HealthRating.POTENTIAL_RED),
        SimpleNamespace(account_id=account_id, overall_rating=HealthRating.RED),
    ]
    account_matrix = [
        SimpleNamespace(entity_id=account_id, entity_label="Acme", overall_rating=HealthRating.RED),
    ]
    [row] = dashboard_service.account_portfolio_health(project_matrix, account_matrix)
    assert row.health_potential_red == 1
    assert row.health_red == 1


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


async def test_my_summary_requires_auth(client):
    response = await client.get("/api/v1/dashboard/my-summary")
    assert response.status_code == 401


async def test_my_summary_returns_zeroed_shape_for_pm(client, override_auth):
    # FakeDB seeds nothing, so every count is 0 — this locks in that the new
    # open_findings_count field is wired into the response.
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/dashboard/my-summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["open_findings_count"] == 0
    assert body["my_projects_count"] == 0
    assert body["open_actions_count"] == 0


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
