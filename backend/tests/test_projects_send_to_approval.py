"""API-surface tests for the Maintain Project "Send To Approval" routes on the
projects router. The readiness computation itself is covered by
test_approval_readiness.py; here compute_approval_readiness is monkeypatched so
the tests exercise auth, the Draft guard, and the 422-vs-200 branch.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.projects import Project
from app.schemas.approval_readiness import ApprovalReadiness, ApprovalReadinessModule
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()

_MANDATORY = ["project_profile", "scope_schedule", "measurement", "commitments", "milestones"]


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
        project_status="Draft",
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


def _readiness(project_status="Draft", incomplete=()):
    modules = [
        ApprovalReadinessModule(
            key=key,
            label=key.replace("_", " ").title(),
            mandatory=True,
            complete=key not in incomplete,
            gaps="missing" if key in incomplete else None,
        )
        for key in _MANDATORY
    ]
    modules.append(
        ApprovalReadinessModule(key="raido", label="RAIDO Register", mandatory=False, complete=False)
    )
    n_incomplete = len(incomplete)
    return ApprovalReadiness(
        completion_pct=round(100 * (5 - n_incomplete) / 5),
        modules_complete=5 - n_incomplete,
        modules_incomplete=n_incomplete,
        gaps_count=n_incomplete,
        critical_gaps=n_incomplete,
        modules=modules,
        project_status=project_status,
        can_submit=n_incomplete == 0 and project_status == "Draft",
    )


@pytest.fixture
def patch_readiness(monkeypatch):
    def _apply(readiness: ApprovalReadiness):
        async def _fake(db, project):
            return readiness

        monkeypatch.setattr(
            "app.api.v1.endpoints.projects.compute_approval_readiness", _fake
        )

    return _apply


# --- auth surface ------------------------------------------------------------


async def test_readiness_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/approval-readiness")
    assert response.status_code == 401


async def test_readiness_rejects_team_member(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.TEAM_MEMBER, get_map={(Project, _PROJECT_ID): project})
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/approval-readiness", headers=headers)
    assert response.status_code == 403


async def test_readiness_ok_for_pm_and_admin(client, override_auth, patch_readiness):
    patch_readiness(_readiness())
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.ADMIN):
        project = _fake_project()
        headers = override_auth(role, get_map={(Project, _PROJECT_ID): project})
        response = await client.get(
            f"/api/v1/projects/{_PROJECT_ID}/approval-readiness", headers=headers
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["modules"]) == 6
        assert body["can_submit"] is True
        assert body["project_status"] == "Draft"


async def test_send_to_approval_rejects_non_pm(client, override_auth):
    project = _fake_project()
    headers = override_auth(RoleCode.TEAM_MEMBER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/send-to-approval", headers=headers)
    assert response.status_code == 403


# --- send-to-approval behaviour -------------------------------------------------


async def test_send_to_approval_422_when_modules_incomplete(client, override_auth, patch_readiness):
    patch_readiness(_readiness(incomplete=("measurement", "milestones")))
    project = _fake_project()
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/send-to-approval", headers=headers)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "readiness" in detail
    assert len(detail["readiness"]["modules"]) == 6
    assert project.project_status == "Draft"


async def test_send_to_approval_422_when_not_draft(client, override_auth, patch_readiness):
    patch_readiness(_readiness(project_status="Pending Approval"))
    project = _fake_project(project_status="Pending Approval")
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/send-to-approval", headers=headers)
    assert response.status_code == 422
    assert "Pending Approval" in response.json()["detail"]["message"]


async def test_send_to_approval_200_from_under_amendment(client, override_auth, patch_readiness, monkeypatch):
    patch_readiness(_readiness(project_status="Under Amendment"))

    async def _no_amendment(db, project_id):
        return None

    monkeypatch.setattr("app.api.v1.endpoints.projects.active_amendment", _no_amendment)
    project = _fake_project(project_status="Under Amendment")
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/send-to-approval", headers=headers)
    assert response.status_code == 200
    assert project.project_status == "Pending Approval"


async def test_send_to_approval_200_flips_status(client, override_auth, patch_readiness):
    patch_readiness(_readiness())
    project = _fake_project()
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/send-to-approval", headers=headers)
    assert response.status_code == 200
    assert project.project_status == "Pending Approval"
    assert response.json()["project_status"] == "Pending Approval"


# --- recall -----------------------------------------------------------------


async def test_recall_rejects_non_pm(client, override_auth):
    project = _fake_project(project_status="Pending Approval")
    headers = override_auth(RoleCode.TEAM_MEMBER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/recall-approval", headers=headers)
    assert response.status_code == 403


async def test_recall_422_when_not_pending_approval(client, override_auth):
    project = _fake_project(project_status="Draft")
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/recall-approval", headers=headers)
    assert response.status_code == 422
    assert "Pending Approval" in response.json()["detail"]


async def test_recall_200_resets_to_draft(client, override_auth):
    project = _fake_project(project_status="Pending Approval", de_review_status="In Review")
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/recall-approval", headers=headers)
    assert response.status_code == 200
    assert project.project_status == "Draft"
    assert project.de_review_status is None
    assert response.json()["project_status"] == "Draft"


async def test_recall_from_amendment_returns_to_under_amendment(client, override_auth, monkeypatch):
    amendment = SimpleNamespace(status="Submitted", submitted_at=datetime.now(UTC))

    async def _active(db, project_id):
        return amendment

    monkeypatch.setattr("app.api.v1.endpoints.projects.active_amendment", _active)
    project = _fake_project(project_status="Pending Approval", de_review_status="In Review")
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/recall-approval", headers=headers)
    assert response.status_code == 200
    assert project.project_status == "Under Amendment"
    assert amendment.status == "In Progress"


# --- initiate amendment ---------------------------------------------------------


async def test_initiate_amendment_rejects_non_pm(client, override_auth):
    project = _fake_project(project_status="Approved")
    headers = override_auth(RoleCode.TEAM_MEMBER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/initiate-amendment", headers=headers)
    assert response.status_code == 403


async def test_initiate_amendment_422_when_not_approved(client, override_auth):
    project = _fake_project(project_status="Draft")
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/initiate-amendment", headers=headers)
    assert response.status_code == 422


async def test_initiate_amendment_422_when_closed(client, override_auth):
    project = _fake_project(project_status="Approved", lifecycle_status="Closed")
    headers = override_auth(RoleCode.ADMIN, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/initiate-amendment", headers=headers)
    assert response.status_code == 422


async def test_initiate_amendment_ok_when_approved_and_on_hold(client, override_auth, monkeypatch):
    async def _no_amendment(db, project_id):
        return None

    async def _initiate(db, project, actor_id):
        project.project_status = "Under Amendment"
        return SimpleNamespace(id=uuid4())

    monkeypatch.setattr("app.api.v1.endpoints.projects.active_amendment", _no_amendment)
    monkeypatch.setattr("app.api.v1.endpoints.projects.initiate_amendment", _initiate)
    project = _fake_project(project_status="Approved", lifecycle_status="Hold")
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/initiate-amendment", headers=headers)
    assert response.status_code == 200


async def test_initiate_amendment_200_flips_to_under_amendment(client, override_auth, monkeypatch):
    async def _no_amendment(db, project_id):
        return None

    async def _initiate(db, project, actor_id):
        project.project_status = "Under Amendment"
        return SimpleNamespace(id=uuid4())

    monkeypatch.setattr("app.api.v1.endpoints.projects.active_amendment", _no_amendment)
    monkeypatch.setattr("app.api.v1.endpoints.projects.initiate_amendment", _initiate)
    project = _fake_project(project_status="Approved")
    headers = override_auth(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project})
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/initiate-amendment", headers=headers)
    assert response.status_code == 200
    assert project.project_status == "Under Amendment"
    assert response.json()["project_status"] == "Under Amendment"
