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
        "finding_date": None,
        "due_date": None,
        "status": "Open",
        "remarks": None,
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


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
