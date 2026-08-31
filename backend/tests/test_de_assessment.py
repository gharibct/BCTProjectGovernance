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


async def test_create_assessment_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/de-assessments", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_assessment_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/de-assessments", json={}, headers=headers)
    assert response.status_code != 403


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
        RoleCode.DELIVERY_EXCELLENCE, get_map={(DEAssessment, assessment_id): assessment}
    )
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments/{assessment_id}",
        json={"pci_score": "50"},
        headers=headers,
    )
    assert response.status_code == 409


# --- Findings ----------------------------------------------------------------------------


async def test_add_finding_assigns_sequence_no_and_new_fields(client, override_auth):
    assessment_id = uuid4()
    assessment = _fake_assessment(id=assessment_id, status="Draft")
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE, get_map={(DEAssessment, assessment_id): assessment}
    )
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments/{assessment_id}/findings",
        json={
            "classification": "Governance",
            "description": "RAID log incomplete",
            "severity": "Critical",
            "due_date": "2026-08-15",
        },
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["sequence_no"] == 1
    assert body["severity"] == "Critical"
    assert body["classification"] == "Governance"
    assert body["overdue"] is True  # due_date in the past, status Open


async def test_update_finding_status_transition(client, override_auth):
    assessment_id = uuid4()
    finding_id = uuid4()
    finding = SimpleNamespace(
        id=finding_id,
        assessment_id=assessment_id,
        sequence_no=1,
        classification="Governance",
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
        RoleCode.DELIVERY_EXCELLENCE, get_map={(DEAssessmentFinding, finding_id): finding}
    )
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/de-assessments/{assessment_id}/findings/{finding_id}",
        json={"status": "Awaiting Closure"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Awaiting Closure"
