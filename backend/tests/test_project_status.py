from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.reference_data import ReportingPeriod
from app.schemas.enums import ProjectStatusCategory, RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_list_status_reports_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/status-reports")
    assert response.status_code == 401


async def test_list_status_reports_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/status-reports", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


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


async def test_list_status_items_returns_200(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(
        f"/api/v1/projects/{_PROJECT_ID}/status-items",
        params={"period_id": str(uuid4()), "category": ProjectStatusCategory.KEY_ACCOMPLISHMENTS.value},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json() == []
