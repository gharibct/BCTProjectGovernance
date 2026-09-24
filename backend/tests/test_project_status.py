from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.projects import Project
from app.models.reference_data import ReportingPeriod
from app.schemas.enums import ProjectStatusCategory, RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()
_PROJECT_GET_MAP = {(Project, _PROJECT_ID): SimpleNamespace(account_id=None, geo_id=None)}


async def test_list_status_reports_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/status-reports")
    assert response.status_code == 401


async def test_list_status_reports_returns_200_for_de_regardless_of_ownership(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map=_PROJECT_GET_MAP)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/status-reports", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_list_status_reports_rejects_team_member_with_no_ownership(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER, get_map=_PROJECT_GET_MAP)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/status-reports", headers=headers)
    assert response.status_code == 403


async def test_create_status_report_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/status-reports", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_status_report_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/status-reports", json={}, headers=headers)
    assert response.status_code != 403


async def test_create_status_report_rejects_unknown_period(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports",
        json={"period_id": str(uuid4())},  # not in the fake DB
        headers=headers,
    )
    assert response.status_code == 422


async def test_create_status_report_defaults_from_previous_period(client, override_auth, monkeypatch):
    period_id = uuid4()
    period = ReportingPeriod(
        id=period_id,
        period_type="Monthly",
        code="2026-09",
        label="Sep 2026",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 30),
        is_active=True,
    )
    previous = SimpleNamespace(
        revenue=Decimal("125000.00"),
        onsite_fte=Decimal("4.00"),
        offshore_fte=Decimal("9.00"),
        projects_count=3,
        key_accomplishments="Shipped release 2.1",
        upcoming_key_releases=None,
        leadership_support_required=None,
    )

    async def _fake_previous(db, project_id, p):
        return previous

    monkeypatch.setattr(
        "app.api.v1.endpoints.project_status._previous_period_report", _fake_previous
    )

    headers = override_auth(RoleCode.ADMIN, get_map={(ReportingPeriod, period_id): period})
    response = await client.post(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports",
        json={"period_id": str(period_id), "revenue": "200000"},  # revenue supplied, rest blank
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert float(body["revenue"]) == 200000  # caller's value kept, not overwritten
    assert float(body["onsite_fte"]) == 4  # carried forward from the previous period
    assert float(body["offshore_fte"]) == 9
    assert body["projects_count"] == 3
    assert body["key_accomplishments"] == "Shipped release 2.1"


async def test_review_status_report_rejects_wrong_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
    )
    assert response.status_code == 403


async def test_review_status_report_passes_account_manager_or_admin_gate(client, override_auth):
    # ADMIN bypasses require_project_account_scope's ownership check entirely
    # (see app.api.deps.require_project_account_scope), so no FakeDB
    # get_map/owned_account_ids setup is needed here.
    headers = override_auth(RoleCode.ADMIN)
    response = await client.patch(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
    )
    assert response.status_code != 403


async def test_resubmitting_rejected_report_clears_prior_review(client, override_auth):
    """A Rejected report can be edited back to Submitted (the PM's resubmit
    path), and doing so wipes the previous reviewer's decision so it re-enters
    review as a clean Submitted report."""
    from datetime import UTC, datetime

    from app.models.project_status import ProjectStatusReport

    report_id = uuid4()
    report = ProjectStatusReport(
        id=report_id,
        project_id=_PROJECT_ID,
        period_id=uuid4(),
        status="Rejected",
        reviewed_by=uuid4(),
        reviewed_at=datetime.now(UTC),
        review_comment="Numbers don't add up",
        customer_report_shared=False,
        open_alerts_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    headers = override_auth(RoleCode.ADMIN, get_map={(ProjectStatusReport, report_id): report})

    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports/{report_id}",
        json={"status": "Submitted"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Submitted"
    assert body["reviewed_by"] is None
    assert body["reviewed_at"] is None
    assert body["review_comment"] is None


async def test_list_status_items_returns_200(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map=_PROJECT_GET_MAP)
    response = await client.get(
        f"/api/v1/projects/{_PROJECT_ID}/status-items",
        params={"period_id": str(uuid4()), "category": ProjectStatusCategory.KEY_ACCOMPLISHMENTS.value},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json() == []


# --- Customer Communication -------------------------------------------------


def _draft_report(**overrides):
    from datetime import UTC, datetime

    from app.models.project_status import ProjectStatusReport

    return ProjectStatusReport(
        id=uuid4(),
        project_id=_PROJECT_ID,
        period_id=uuid4(),
        status="Draft",
        open_alerts_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        **overrides,
    )


async def _put(client, override_auth, report, body):
    from app.models.project_status import ProjectStatusReport

    headers = override_auth(RoleCode.ADMIN, get_map={(ProjectStatusReport, report.id): report})
    return await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/status-reports/{report.id}", json=body, headers=headers
    )


async def test_submit_requires_customer_communication_answer(client, override_auth):
    response = await _put(client, override_auth, _draft_report(), {"status": "Submitted"})
    assert response.status_code == 400
    assert "shared with the customer" in response.json()["detail"]


async def test_submit_shared_requires_date_and_file(client, override_auth):
    no_date = await _put(
        client,
        override_auth,
        _draft_report(customer_report_shared=True, customer_report_file_path="x/y.pdf"),
        {"status": "Submitted"},
    )
    assert no_date.status_code == 400
    assert "Date Shared" in no_date.json()["detail"]

    no_file = await _put(
        client,
        override_auth,
        _draft_report(customer_report_shared=True, customer_report_date=date(2026, 9, 1)),
        {"status": "Submitted"},
    )
    assert no_file.status_code == 400
    assert "Presentation / Status Report" in no_file.json()["detail"]


async def test_submit_passes_when_shared_with_date_and_file(client, override_auth):
    report = _draft_report(
        customer_report_shared=True, customer_report_date=date(2026, 9, 1), customer_report_file_path="x/y.pdf"
    )
    response = await _put(client, override_auth, report, {"status": "Submitted"})
    assert response.status_code == 200


async def test_answering_no_clears_date_and_file(client, override_auth):
    report = _draft_report(
        customer_report_shared=True,
        customer_report_date=date(2026, 9, 1),
        customer_report_file_name="deck.pdf",
        customer_report_file_path="does-not-exist/deck.pdf",
    )
    response = await _put(client, override_auth, report, {"customer_report_shared": False})
    assert response.status_code == 200
    body = response.json()
    assert body["customer_report_shared"] is False
    assert body["customer_report_date"] is None
    assert body["customer_report_file_name"] is None
