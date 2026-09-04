from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.projects import Project
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()
_REVIEWER_ID = uuid4()


def _fake_project(**overrides):
    now = datetime.now(UTC)
    defaults = dict(
        id=_PROJECT_ID,
        project_code="PRJ-1",
        project_name="Alpha Migration",
        contract_type=None,
        project_type_id=None,
        organization_id=None,
        project_owned=None,
        geo_id=None,
        region_id=None,
        account_id=None,
        project_manager_id=None,
        delivery_manager_id=None,
        delivery_excellence_id=None,
        project_revenue=Decimal("100"),
        project_currency="USD",
        billing_type=None,
        engagement_type=None,
        critical_flag=None,
        product_flag=None,
        product_id=None,
        customer_overview=None,
        project_scope_description=None,
        planned_start_date=date(2026, 1, 1),
        actual_start_date=None,
        planned_end_date=date(2026, 6, 1),
        actual_end_date=None,
        applicable_phase=None,
        project_status="Pending Approval",
        lifecycle_status=None,
        planned_duration_days=None,
        actual_duration_days=None,
        delivery_declared_overall_health=None,
        de_assessed_project_health=None,
        overall_project_health=None,
        de_review_status=None,
        de_review_remarks=None,
        de_reviewed_by=None,
        de_reviewed_at=None,
        de_allocated_at=None,
        created_by=None,
        updated_by=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# --- queue auth surface --------------------------------------------------------


async def test_queue_requires_auth(client):
    response = await client.get("/api/v1/de-approval/queue")
    assert response.status_code == 401


async def test_queue_rejects_pm(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/de-approval/queue", headers=headers)
    assert response.status_code == 403


async def test_queue_allows_de_and_admin(client, override_auth):
    for role in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN):
        headers = override_auth(role)
        response = await client.get("/api/v1/de-approval/queue", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["kpis"] == {"awaiting_review": 0, "in_review": 0, "returned": 0}
        assert body["rows"] == []


async def test_queue_row_carries_geo_region_and_project_type():
    from app.schemas.de_approval import DeApprovalQueueRow

    row = DeApprovalQueueRow(
        project_id=_PROJECT_ID,
        project_code="PRJ-1",
        project_name="Alpha Migration",
        account_name="Globex",
        geo_name="APAC",
        region_name="India",
        project_type_name="Development",
        project_manager_name="S. Connor",
        completion_pct=80,
        gaps_count=1,
        project_status="Pending Approval",
        de_review_status=None,
        last_updated=datetime.now(UTC),
        href=f"/de-approval/{_PROJECT_ID}",
    )
    dumped = row.model_dump()
    assert dumped["geo_name"] == "APAC"
    assert dumped["region_name"] == "India"
    assert dumped["project_type_name"] == "Development"


# --- decision ---------------------------------------------------------------


async def test_decision_rejects_non_de(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.patch(
        f"/api/v1/de-approval/{_PROJECT_ID}/decision",
        json={"decision": "Approve", "remarks": "ok", "reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 403


async def test_decision_rejects_when_not_pending_approval(client, override_auth):
    project = _fake_project(project_status="Draft")
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.patch(
        f"/api/v1/de-approval/{_PROJECT_ID}/decision",
        json={"decision": "Approve", "remarks": "ok", "reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 400


async def test_decision_requires_remarks(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.patch(
        f"/api/v1/de-approval/{_PROJECT_ID}/decision",
        json={"decision": "Approve", "remarks": "", "reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 422


async def test_approve_sets_status_and_review_fields(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.patch(
        f"/api/v1/de-approval/{_PROJECT_ID}/decision",
        json={"decision": "Approve", "remarks": "Governance complete.", "reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_status == "Approved"
    assert project.de_review_status == "Approved"
    assert project.de_review_remarks == "Governance complete."
    assert project.de_reviewed_by == _REVIEWER_ID
    assert project.de_reviewed_at is not None


async def test_return_resets_project_to_draft(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.patch(
        f"/api/v1/de-approval/{_PROJECT_ID}/decision",
        json={"decision": "Return", "remarks": "Financials incomplete.", "reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_status == "Draft"
    assert project.de_review_status == "Returned"


async def test_return_of_amendment_goes_to_under_amendment(client, override_auth, monkeypatch):
    amendment = SimpleNamespace(status="Submitted", submitted_at=None, completed_at=None)

    async def _active(db, project_id):
        return amendment

    monkeypatch.setattr("app.api.v1.endpoints.de_approval.active_amendment", _active)
    project = _fake_project()
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.patch(
        f"/api/v1/de-approval/{_PROJECT_ID}/decision",
        json={"decision": "Return", "remarks": "Rework the scope.", "reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_status == "Under Amendment"
    assert project.de_review_status == "Returned"
    assert amendment.status == "In Progress"


async def test_approve_of_amendment_completes_it(client, override_auth, monkeypatch):
    amendment = SimpleNamespace(status="Submitted", submitted_at=None, completed_at=None)

    async def _active(db, project_id):
        return amendment

    monkeypatch.setattr("app.api.v1.endpoints.de_approval.active_amendment", _active)
    project = _fake_project()
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.patch(
        f"/api/v1/de-approval/{_PROJECT_ID}/decision",
        json={"decision": "Approve", "remarks": "Looks good.", "reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 200
    assert project.project_status == "Approved"
    assert amendment.status == "Completed"
    assert amendment.completed_at is not None


# --- per-module review ------------------------------------------------------


async def test_module_review_marks_project_in_review(client, override_auth):
    project = _fake_project(de_review_status=None)
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.put(
        f"/api/v1/de-approval/{_PROJECT_ID}/modules/project_profile",
        json={"review_action": "Gap Identified"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["review_action"] == "Gap Identified"
    assert project.de_review_status == "In Review"
