"""PM Findings API (app.api.v1.endpoints.pm_findings). No Postgres — runs
through the real app with the DB layer swapped for FakeDB (see
tests/test_authorization.py), so list/KPI queries come back empty and the
assertions are about gating + response shape + the "Action Taken" transition.
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
    defaults = {"id": _PROJECT_ID, "project_manager_id": uuid4()}
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


# --- GET /pm-findings (list) --------------------------------------------------


async def test_list_requires_auth(client):
    response = await client.get("/api/v1/pm-findings")
    assert response.status_code == 401


@pytest.mark.parametrize("role", [RoleCode.TEAM_MEMBER, RoleCode.DELIVERY_EXCELLENCE])
async def test_list_forbidden_for_non_pm(client, override_auth, role):
    headers = override_auth(role)
    response = await client.get("/api/v1/pm-findings", headers=headers)
    assert response.status_code == 403


@pytest.mark.parametrize("role", [RoleCode.PROJECT_MANAGER, RoleCode.ADMIN])
async def test_list_ok_and_paged_shape(client, override_auth, role):
    headers = override_auth(role)
    response = await client.get("/api/v1/pm-findings", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "skip": 0, "limit": 50}


async def test_list_accepts_filter_params(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get(
        "/api/v1/pm-findings",
        params={
            "project_id": str(uuid4()),
            "status": "Open",
            "bucket": "overdue",
            "skip": 5,
            "limit": 3,
        },
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["skip"] == 5
    assert body["limit"] == 3


# --- GET /pm-findings/kpis ----------------------------------------------------


async def test_kpis_forbidden_for_de(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    response = await client.get("/api/v1/pm-findings/kpis", headers=headers)
    assert response.status_code == 403


async def test_kpis_shape_for_pm(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/pm-findings/kpis", headers=headers)
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


# --- PUT /pm-findings/{id}/action-taken -------------------------------------------


async def test_action_taken_as_owning_pm(client, override_auth):
    finding_id = uuid4()
    project = _fake_project()
    headers = override_auth(
        RoleCode.PROJECT_MANAGER,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id, status="Open"),
            (Project, _PROJECT_ID): project,
        },
    )
    # Fix the project's PM to the caller (only knowable after override_auth ran);
    # get_map holds the same object, read at request time.
    project.project_manager_id = override_auth.user.id

    response = await client.put(
        f"/api/v1/pm-findings/{finding_id}/action-taken",
        json={"remarks": "Reconfigured the pipeline and validated"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Awaiting Closure"
    assert body["remarks"] == "Reconfigured the pipeline and validated"


async def test_action_taken_as_admin_bypasses_owner_check(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.ADMIN,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id, status="In Progress"),
            (Project, _PROJECT_ID): _fake_project(),  # PM is someone else
        },
    )
    response = await client.put(
        f"/api/v1/pm-findings/{finding_id}/action-taken",
        json={"remarks": "Closed out on the PM's behalf"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Awaiting Closure"


async def test_action_taken_requires_remarks(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.PROJECT_MANAGER,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id),
            (Project, _PROJECT_ID): _fake_project(),
        },
    )
    for body in ({}, {"remarks": ""}):
        response = await client.put(
            f"/api/v1/pm-findings/{finding_id}/action-taken", json=body, headers=headers
        )
        assert response.status_code == 422


async def test_action_taken_forbidden_for_de(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAssessmentFinding, finding_id): _fake_finding(id=finding_id)},
    )
    response = await client.put(
        f"/api/v1/pm-findings/{finding_id}/action-taken",
        json={"remarks": "x"},
        headers=headers,
    )
    assert response.status_code == 403


async def test_action_taken_forbidden_when_not_the_projects_pm(client, override_auth):
    finding_id = uuid4()
    headers = override_auth(
        RoleCode.PROJECT_MANAGER,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id),
            (Project, _PROJECT_ID): _fake_project(project_manager_id=uuid4()),  # not the caller
        },
    )
    response = await client.put(
        f"/api/v1/pm-findings/{finding_id}/action-taken",
        json={"remarks": "trying to touch someone else's project"},
        headers=headers,
    )
    assert response.status_code == 403


async def test_action_taken_404_when_finding_missing(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)  # empty get_map
    response = await client.put(
        f"/api/v1/pm-findings/{uuid4()}/action-taken",
        json={"remarks": "x"},
        headers=headers,
    )
    assert response.status_code == 404


async def test_action_taken_409_when_finding_already_closed(client, override_auth):
    finding_id = uuid4()
    project = _fake_project()
    headers = override_auth(
        RoleCode.PROJECT_MANAGER,
        get_map={
            (DEAssessmentFinding, finding_id): _fake_finding(id=finding_id, status="Closed"),
            (Project, _PROJECT_ID): project,
        },
    )
    project.project_manager_id = override_auth.user.id
    response = await client.put(
        f"/api/v1/pm-findings/{finding_id}/action-taken",
        json={"remarks": "too late"},
        headers=headers,
    )
    assert response.status_code == 409
