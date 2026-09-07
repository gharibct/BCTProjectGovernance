"""Portfolio-wide DE Findings API (app.api.v1.endpoints.de_findings) + the pure
KPI reduction (app.services.de_findings.compute_kpis). No Postgres — the
endpoint tests run through the real app with the DB layer swapped for FakeDB
(see tests/test_authorization.py), so list/KPI queries come back empty and the
assertions are about gating + response shape + param parsing; the counting math
is covered directly by test_compute_kpis_math.
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.de_assessment import DEAssessmentFinding
from app.models.projects import Project
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


def _fake_project(**overrides):
    defaults = {
        "id": _PROJECT_ID,
        "delivery_excellence_id": uuid4(),  # a DE is allocated — write gate needs one
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _fake_finding(**overrides):
    now = datetime.now(UTC)
    defaults = {
        "id": uuid4(),
        "project_id": _PROJECT_ID,
        "sequence_no": 1,
        "category": "Core Delivery",
        "classification": "NC",
        "description": "x",
        "assigned_to": None,
        "action_taken": None,
        "action_taken_date": None,
        "finding_date": None,
        "due_date": None,
        "status": "Open",
        "remarks": None,
        "closure_date": None,
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# --- _conditions (pure) -----------------------------------------------------
# The status sentinel handling + "a bucket owns the status dimension" rule that
# keeps a KPI tile's count from disagreeing with an empty grid.

from app.services.de_findings import DEFindingFilters, _conditions  # noqa: E402


def _rendered(filters: DEFindingFilters) -> list[str]:
    return [str(c) for c in _conditions(filters)]


async def test_conditions_status_active_excludes_closed_and_cancelled():
    rendered = _rendered(DEFindingFilters(status="Active"))
    assert any("status NOT IN" in r for r in rendered)


async def test_conditions_status_all_applies_no_status_filter():
    assert not any("status" in r for r in _rendered(DEFindingFilters(status="All")))
    assert not any("status" in r for r in _rendered(DEFindingFilters(status=None)))


async def test_conditions_concrete_status_is_an_exact_match():
    conditions = _conditions(DEFindingFilters(status="Closed"))
    assert any(getattr(c, "right", None) is not None and c.right.value == "Closed" for c in conditions)


async def test_conditions_bucket_owns_status_dimension():
    # "Active" (the default) + the closed_this_period tile must NOT produce the
    # contradictory "status NOT IN (Closed, Cancelled)" AND "status = Closed".
    rendered = _rendered(DEFindingFilters(status="Active", bucket="closed_this_period"))
    assert not any("NOT IN" in r for r in rendered)
    assert any("status =" in r.replace("!=", "") for r in rendered)


async def test_conditions_closed_this_period_bucket_matches_closed():
    conditions = _conditions(DEFindingFilters(bucket="closed_this_period"))
    assert any(getattr(c, "right", None) is not None and c.right.value == "Closed" for c in conditions)


# --- GET /de-findings (list) --------------------------------------------------


async def test_list_requires_auth(client):
    response = await client.get("/api/v1/de-findings")
    assert response.status_code == 401


async def test_list_forbidden_for_team_member(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/de-findings", headers=headers)
    assert response.status_code == 403


@pytest.mark.parametrize("role", [RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN])
async def test_list_ok_and_paged_shape(client, override_auth, role):
    headers = override_auth(role)
    response = await client.get("/api/v1/de-findings", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "skip": 0, "limit": 50}


async def test_list_accepts_all_filter_params(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    response = await client.get(
        "/api/v1/de-findings",
        params={
            "geo_id": str(uuid4()),
            "account_id": str(uuid4()),
            "project_id": str(uuid4()),
            "classification": "Observation",
            "status": "Open",
            "search": "governance",
            "bucket": "overdue",
            "skip": 10,
            "limit": 5,
        },
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["skip"] == 10
    assert body["limit"] == 5


async def test_list_rejects_bad_uuid_param(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    response = await client.get("/api/v1/de-findings", params={"geo_id": "not-a-uuid"}, headers=headers)
    assert response.status_code == 422


# --- GET /de-findings/kpis -------------------------------------------------------


async def test_kpis_forbidden_for_non_de(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/de-findings/kpis", headers=headers)
    assert response.status_code == 403


async def test_kpis_shape_for_de(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    response = await client.get("/api/v1/de-findings/kpis", headers=headers)
    assert response.status_code == 200
    body = response.json()
    for key in (
        "open_findings",
        "overdue",
        "awaiting_closure",
        "closed_this_period",
        "overdue_30d_count",
        "awaiting_closure_count",
        "projects_over_5_open_count",
    ):
        assert body[key] == 0
    assert "period_label" in body


# --- POST /de-findings --------------------------------------------------------


async def test_create_with_project_in_body_as_de(client, override_auth):
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(Project, _PROJECT_ID): _fake_project()},
    )
    response = await client.post(
        "/api/v1/de-findings",
        json={
            "project_id": str(_PROJECT_ID),
            "category": "Core Delivery",
            "classification": "NC",
            "description": "Monthly governance evidence incomplete",
            "due_date": "2026-08-15",
        },
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == str(_PROJECT_ID)
    assert body["sequence_no"] == 1
    assert body["category"] == "Core Delivery"
    assert body["classification"] == "NC"
    assert body["overdue"] is True  # past due_date, status Open


async def test_create_forbidden_for_non_de(client, override_auth):
    headers = override_auth(
        RoleCode.PROJECT_MANAGER,
        get_map={(Project, _PROJECT_ID): _fake_project()},
    )
    response = await client.post(
        "/api/v1/de-findings",
        json={"project_id": str(_PROJECT_ID), "category": "Core Delivery", "classification": "NC"},
        headers=headers,
    )
    assert response.status_code == 403


async def test_create_forbidden_when_project_has_no_de(client, override_auth):
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(Project, _PROJECT_ID): _fake_project(delivery_excellence_id=None)},
    )
    response = await client.post(
        "/api/v1/de-findings",
        json={"project_id": str(_PROJECT_ID), "category": "Core Delivery", "classification": "NC"},
        headers=headers,
    )
    assert response.status_code == 403


async def test_create_404_when_project_missing(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)  # empty get_map
    response = await client.post(
        "/api/v1/de-findings",
        json={"project_id": str(_PROJECT_ID), "category": "Core Delivery", "classification": "NC"},
        headers=headers,
    )
    assert response.status_code == 404


# --- PUT /de-findings/{finding_id} ------------------------------------------------


async def test_update_status_transition_as_de(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id),
            (Project, _PROJECT_ID): _fake_project(),
        },
    )
    response = await client.put(
        f"/api/v1/de-findings/{finding_id}",
        json={"status": "Awaiting Closure"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Awaiting Closure"


async def test_update_forbidden_for_non_de(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.TEAM_MEMBER,
        get_map={(DEAssessmentFinding, finding_id): _fake_finding(id=finding_id)},
    )
    response = await client.put(
        f"/api/v1/de-findings/{finding_id}", json={"status": "Closed"}, headers=headers
    )
    assert response.status_code == 403


async def test_update_forbidden_when_project_has_no_de(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id),
            (Project, _PROJECT_ID): _fake_project(delivery_excellence_id=None),
        },
    )
    response = await client.put(
        f"/api/v1/de-findings/{finding_id}", json={"status": "Closed"}, headers=headers
    )
    assert response.status_code == 403


async def test_update_404_when_finding_missing(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)  # empty get_map
    response = await client.put(
        f"/api/v1/de-findings/{uuid4()}", json={"status": "Closed"}, headers=headers
    )
    assert response.status_code == 404


# --- DE Findings Closure: closure_date + verification remarks + reopen ----------


async def test_closing_without_a_date_defaults_closure_date_to_today(client, override_auth):
    from datetime import date

    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id, status="Awaiting Closure"),
            (Project, _PROJECT_ID): _fake_project(),
        },
    )
    response = await client.put(
        f"/api/v1/de-findings/{finding_id}",
        json={"status": "Closed", "remarks": "Verified in prod"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Closed"
    assert body["closure_date"] == date.today().isoformat()
    assert body["remarks"] == "Verified in prod"


async def test_closing_keeps_an_explicit_closure_date(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id, status="Awaiting Closure"),
            (Project, _PROJECT_ID): _fake_project(),
        },
    )
    response = await client.put(
        f"/api/v1/de-findings/{finding_id}",
        json={"status": "Closed", "closure_date": "2026-08-15", "remarks": "ok"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["closure_date"] == "2026-08-15"


async def test_a_closed_finding_cannot_be_reopened(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(
                id=finding_id, status="Closed", closure_date="2026-08-15", remarks="Verified"
            ),
            (Project, _PROJECT_ID): _fake_project(),
        },
    )
    response = await client.put(
        f"/api/v1/de-findings/{finding_id}",
        json={"status": "Open"},
        headers=headers,
    )
    assert response.status_code == 409


async def test_reopening_from_awaiting_closure_goes_to_open_and_clears_closure_fields(
    client, override_auth
):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(
                id=finding_id, status="Awaiting Closure", closure_date="2026-08-15", remarks="draft"
            ),
            (Project, _PROJECT_ID): _fake_project(),
        },
    )
    response = await client.put(
        f"/api/v1/de-findings/{finding_id}",
        json={"status": "Open"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Open"
    assert body["closure_date"] is None
    assert body["remarks"] is None


# --- GET /de-findings/{id}/history -----------------------------------------------


async def test_finding_history_forbidden_for_non_de(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.TEAM_MEMBER,
        get_map={(DEAssessmentFinding, finding_id): _fake_finding(id=finding_id)},
    )
    response = await client.get(f"/api/v1/de-findings/{finding_id}/history", headers=headers)
    assert response.status_code == 403


async def test_finding_history_404_when_finding_missing(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)  # empty get_map
    response = await client.get(f"/api/v1/de-findings/{uuid4()}/history", headers=headers)
    assert response.status_code == 404


async def test_finding_history_returns_a_list_for_de(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAssessmentFinding, finding_id): _fake_finding(id=finding_id)},
    )
    response = await client.get(f"/api/v1/de-findings/{finding_id}/history", headers=headers)
    assert response.status_code == 200
    assert response.json() == []
