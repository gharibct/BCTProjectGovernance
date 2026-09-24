"""Project Health drill-down "Project List" screen — the Ownership + Region
filters added to GET /dashboard/project-health/projects, plus the pure
_project_conditions builder they hang off."""

from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from app.services.dashboard import DashboardFilters, _project_conditions
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio


# --- _project_conditions (pure) ------------------------------------------------


async def test_project_conditions_empty_filters_produce_no_conditions():
    assert _project_conditions(DashboardFilters()) == []


async def test_project_conditions_includes_region_and_ownership():
    region_id = uuid4()
    conditions = _project_conditions(
        DashboardFilters(region_id=region_id, project_owned="Fully Owned")
    )
    rendered = [str(c) for c in conditions]
    assert any("projects.region_id" in r for r in rendered)
    assert any("projects.project_owned" in r for r in rendered)

    # The filter values are carried through as bound parameters.
    bound_values = [c.right.value for c in conditions]
    assert region_id in bound_values
    assert "Fully Owned" in bound_values


async def test_project_conditions_region_and_ownership_are_independent():
    assert len(_project_conditions(DashboardFilters(region_id=uuid4()))) == 1
    assert len(_project_conditions(DashboardFilters(project_owned="Co-Owned"))) == 1


# --- GET /dashboard/project-health/projects -----------------------------------

_URL = "/api/v1/dashboard/project-health/projects"


async def test_project_list_requires_auth(client):
    response = await client.get(_URL)
    assert response.status_code == 401


async def test_project_list_is_open_to_every_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(_URL, headers=headers)
    assert response.status_code == 200


async def test_project_list_accepts_region_and_ownership_filters(client, override_auth):
    headers = override_auth(RoleCode.PMO)
    response = await client.get(
        _URL,
        params={"region_id": str(uuid4()), "project_owned": "Fully Owned"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    # FakeDB seeds nothing — this just locks in that the two new query params
    # are wired through the endpoint signature without erroring.
    assert body["items"] == []
    assert body["total"] == 0


async def test_project_list_rejects_non_uuid_region(client, override_auth):
    headers = override_auth(RoleCode.PMO)
    response = await client.get(_URL, params={"region_id": "not-a-uuid"}, headers=headers)
    assert response.status_code == 422


# --- every Project Health drill-down list endpoint ---------------------------
# These 15 grids back the Project Health dashboard's report cards
# (design-reference/project-health-screens.md). They share one role gate
# (any signed-in user; results are role-scoped) and the {items,total,skip,limit}
# Page shape. FakeDB seeds nothing, so each returns an empty page — enough to
# lock in that the route is mounted, gated, and doesn't raise.

_DRILLDOWN_PATHS = [
    "projects",
    "rag",
    "account-rag",
    "risks",
    "issues",
    "dependencies",
    "assumptions",
    "opportunities",
    "metrics",
    "commitments",
    "payment-milestones",
    "assessments",
    "findings",
    "actions",
    "data-integrity",
]


def _drilldown_url(path: str) -> str:
    return f"/api/v1/dashboard/project-health/{path}"


@pytest.mark.parametrize("path", _DRILLDOWN_PATHS)
async def test_drilldown_requires_auth(client, path):
    assert (await client.get(_drilldown_url(path))).status_code == 401


# Project Health is open to every signed-in user (results are role-scoped, not
# role-gated), so even a Team Member gets a 200 — just with nothing in scope.
@pytest.mark.parametrize("path", _DRILLDOWN_PATHS)
async def test_drilldown_is_open_to_every_role(client, override_auth, path):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    assert (await client.get(_drilldown_url(path), headers=headers)).status_code == 200


@pytest.mark.parametrize("role", list(RoleCode))
@pytest.mark.parametrize("path", _DRILLDOWN_PATHS)
async def test_drilldown_returns_empty_page_for_privileged_role(client, override_auth, path, role):
    headers = override_auth(role)
    response = await client.get(_drilldown_url(path), headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert {"items", "total", "skip", "limit"} <= body.keys()


@pytest.mark.parametrize("path", ["", "/periods"])
async def test_geo_head_can_open_project_health_dashboard(client, override_auth, path):
    headers = override_auth(RoleCode.GEO_HEAD)
    response = await client.get(f"/api/v1/dashboard/project-health{path}", headers=headers)
    assert response.status_code == 200


async def test_geo_head_cannot_filter_to_a_geo_they_do_not_own(client, override_auth):
    headers = override_auth(RoleCode.GEO_HEAD)
    response = await client.get(_URL, params={"geo_id": str(uuid4())}, headers=headers)
    assert response.status_code == 403


async def test_account_manager_cannot_filter_to_an_account_they_do_not_own(client, override_auth):
    headers = override_auth(RoleCode.ACCOUNT_MANAGER)
    response = await client.get(_URL, params={"account_id": str(uuid4())}, headers=headers)
    assert response.status_code == 403


async def test_project_health_summary_requires_auth(client):
    assert (await client.get("/api/v1/dashboard/project-health")).status_code == 401


@pytest.mark.parametrize("role", list(RoleCode))
async def test_project_health_summary_is_open_to_every_role(client, override_auth, role):
    headers = override_auth(role)
    assert (await client.get("/api/v1/dashboard/project-health", headers=headers)).status_code == 200


@pytest.mark.parametrize(
    "role", [RoleCode.PMO, RoleCode.ADMIN, RoleCode.CDO, RoleCode.DELIVERY_EXCELLENCE]
)
async def test_project_health_summary_returns_zeroed_shape_for_privileged_role(
    client, override_auth, role
):
    headers = override_auth(role)
    response = await client.get("/api/v1/dashboard/project-health", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["portfolio"]["total_count"] == 0
    assert body["risks"]["open_count"] == 0
    assert body["period_id"] is None
