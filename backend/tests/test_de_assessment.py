from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.de_assessment import DEAssessment, DEAssessmentFinding
from app.models.projects import Project
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


def _fake_project(**overrides):
    defaults = {
        "id": _PROJECT_ID,
        "delivery_excellence_id": uuid4(),  # a DE is allocated — write gate needs one
        "delivery_declared_overall_health": "Green",
        "de_assessed_project_health": "Green",
        "overall_project_health": "Green",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _fake_assessment(**overrides):
    now = datetime.now(UTC)
    defaults = {
        "id": uuid4(),
        "project_id": _PROJECT_ID,
        "assessment_date": date.today(),
        "de_assessed_project_health": "Amber",
        "pci_score": None,
        "remarks": None,
        "status": "Draft",
        "next_assessment_due_date": None,
        "assessed_by": None,
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# --- existing auth-surface checks -------------------------------------------------


async def test_list_assessments_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/de-assessments")
    assert response.status_code == 401


async def test_list_assessments_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/de-assessments", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_assessment_rejects_non_de(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/de-assessments", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_assessment_rejects_project_manager(client, override_auth):
    # A DE assessment is Delivery Excellence's own activity — PMs can no longer write one.
    project = _fake_project()
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/de-assessments", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_assessment_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/de-assessments", json={}, headers=headers)
    assert response.status_code != 403


async def test_create_rejected_when_no_de_allocated(client, override_auth):
    project = _fake_project(delivery_excellence_id=None)
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments",
        json={"de_assessed_project_health": "Green", "status": "Draft"},
        headers=headers,
    )
    assert response.status_code == 403


async def test_any_de_can_create_when_project_has_a_de(client, override_auth):
    # All DEs are treated equally — the caller need not be the allocated DE.
    project = _fake_project(delivery_excellence_id=uuid4())
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments",
        json={"de_assessed_project_health": "Green", "status": "Draft"},
        headers=headers,
    )
    assert response.status_code == 201


async def test_assessed_by_is_set_from_session(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments",
        json={"de_assessed_project_health": "Green", "status": "Draft", "assessed_by": str(uuid4())},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["assessed_by"] == str(override_auth.user.id)


async def test_multiple_assessments_in_the_same_month_are_allowed(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Project, _PROJECT_ID): project})
    body = {"de_assessed_project_health": "Amber", "status": "Draft", "assessment_date": "2026-08-05"}
    first = await client.post(f"/api/v1/projects/{_PROJECT_ID}/de-assessments", json=body, headers=headers)
    second = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments",
        json={**body, "assessment_date": "2026-08-20"},
        headers=headers,
    )
    assert first.status_code == 201
    assert second.status_code == 201


async def test_get_latest_assessment_404s_when_none_recorded(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/de-assessments/latest", headers=headers)
    assert response.status_code == 404


# --- Draft lifecycle -----------------------------------------------------------------


async def test_delivery_excellence_can_create_draft_without_health_writeback(client, override_auth):
    project = _fake_project(de_assessed_project_health="Green")
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments",
        json={"de_assessed_project_health": "Red", "status": "Draft"},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["status"] == "Draft"
    # A draft must not touch the Project Charter's cached health.
    assert project.de_assessed_project_health == "Green"


async def test_create_submitted_assessment_writes_back_project_health(client, override_auth):
    project = _fake_project(delivery_declared_overall_health="Green", de_assessed_project_health="Green")
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments",
        json={"de_assessed_project_health": "Red"},  # status defaults to Submitted
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["status"] == "Submitted"
    assert project.de_assessed_project_health == "Red"
    assert project.overall_project_health == "Red"


async def test_patch_draft_to_submitted_finalizes(client, override_auth):
    assessment_id = uuid4()
    assessment = _fake_assessment(id=assessment_id, status="Draft", de_assessed_project_health="Amber")
    project = _fake_project(delivery_declared_overall_health="Green")
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAssessment, assessment_id): assessment, (Project, _PROJECT_ID): project},
    )
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments/{assessment_id}",
        json={"status": "Submitted", "remarks": "Signed off."},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Submitted"
    assert project.de_assessed_project_health == "Amber"


async def test_patch_rejected_once_submitted(client, override_auth):
    assessment_id = uuid4()
    assessment = _fake_assessment(id=assessment_id, status="Submitted")
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAssessment, assessment_id): assessment, (Project, _PROJECT_ID): _fake_project()},
    )
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments/{assessment_id}",
        json={"pci_score": "50"},
        headers=headers,
    )
    assert response.status_code == 409


async def test_patch_draft_can_update_assessment_date(client, override_auth):
    assessment_id = uuid4()
    assessment = _fake_assessment(id=assessment_id, status="Draft")
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAssessment, assessment_id): assessment, (Project, _PROJECT_ID): _fake_project()},
    )
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments/{assessment_id}",
        json={"assessment_date": "2026-08-27"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["assessment_date"] == "2026-08-27"


# --- Findings ----------------------------------------------------------------------------


async def test_add_finding_assigns_sequence_no_and_new_fields(client, override_auth):
    # Findings are a project-level register — no assessment required.
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(Project, _PROJECT_ID): _fake_project()},
    )
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessment-findings",
        json={
            "classification": "Core Delivery",
            "description": "RAID log incomplete",
            "severity": "Critical",
            "due_date": "2026-08-15",
        },
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == str(_PROJECT_ID)
    assert body["sequence_no"] == 1
    assert body["severity"] == "Critical"
    assert body["classification"] == "Core Delivery"
    assert body["overdue"] is True  # due_date in the past, status Open


async def test_update_finding_status_transition(client, override_auth):
    finding_id = uuid4()
    finding = SimpleNamespace(
        id=finding_id,
        project_id=_PROJECT_ID,
        sequence_no=1,
        classification="Core Delivery",
        description="x",
        severity="High",
        assigned_to=None,
        action_taken=None,
        finding_date=None,
        due_date=None,
        status="Open",
        remarks=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(DEAssessmentFinding, finding_id): finding, (Project, _PROJECT_ID): _fake_project()},
    )
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessment-findings/{finding_id}",
        json={"status": "Awaiting Closure"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Awaiting Closure"
