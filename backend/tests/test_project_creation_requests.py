"""New Project Creation flow — /project-creation-requests. Same FakeDB pattern as
tests/test_de_approval.py: the role/scope gate is exercised through the real app
with get_current_user/get_db overridden, and fake rows are handed in via get_map.
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from app.models.project_creation_request import ProjectCreationRequest
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_REQUEST_ID = uuid4()
_PM_ID = uuid4()
_REVIEWER_ID = uuid4()

_VALID_BODY = {
    "project_name": "Core Banking Modernization",
    "project_manager_id": str(_PM_ID),
    "oracle_project_ids": ["ORA-1", "ORA-2"],
}


@pytest.fixture(autouse=True)
def _no_oracle_blockers(monkeypatch):
    """FakeDB can't answer the oracle_project_master / mapping queries, so the
    endpoint tests stub the validator (covered for real in
    tests/test_oracle_id_validation.py). Tests that need a blocker re-patch it."""

    async def none_blocked(*args, **kwargs):
        return {}

    monkeypatch.setattr("app.api.v1.endpoints.project_creation_requests.oracle_id_blockers", none_blocked)


def _fake_request(**overrides):
    now = datetime.now(UTC)
    defaults = dict(
        id=_REQUEST_ID,
        project_name="Core Banking Modernization",
        project_manager_id=_PM_ID,
        organization_id=None,
        geo_id=None,
        region_id=None,
        account_id=None,
        status="Pending",
        requested_by=uuid4(),
        approved_project_id=None,
        reviewed_by=None,
        reviewed_at=None,
        review_remarks=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# --- submit -----------------------------------------------------------------


async def test_create_request_requires_auth(client):
    response = await client.post("/api/v1/project-creation-requests", json=_VALID_BODY)
    assert response.status_code == 401


async def test_create_request_rejects_pm(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.post("/api/v1/project-creation-requests", json=_VALID_BODY, headers=headers)
    assert response.status_code == 403


async def test_create_request_allows_account_and_geo_head(client, override_auth):
    for role in (RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN):
        headers = override_auth(role)
        response = await client.post(
            "/api/v1/project-creation-requests", json=_VALID_BODY, headers=headers
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["status"] == "Pending"
        assert body["project_name"] == "Core Banking Modernization"
        assert body["oracle_project_ids"] == ["ORA-1", "ORA-2"]


async def test_create_request_needs_at_least_one_oracle_id(client, override_auth):
    headers = override_auth(RoleCode.ACCOUNT_MANAGER)
    response = await client.post(
        "/api/v1/project-creation-requests",
        json={**_VALID_BODY, "oracle_project_ids": []},
        headers=headers,
    )
    assert response.status_code == 422


async def test_create_request_rejects_blocked_oracle_id(client, override_auth, monkeypatch):
    async def blocked(db, ids, **kwargs):
        return {"ORA-2": "Oracle Project ID ORA-2 is already mapped to project PRJ-1 - X (Closed)."}

    monkeypatch.setattr("app.api.v1.endpoints.project_creation_requests.oracle_id_blockers", blocked)
    headers = override_auth(RoleCode.ACCOUNT_MANAGER)
    response = await client.post("/api/v1/project-creation-requests", json=_VALID_BODY, headers=headers)
    assert response.status_code == 422
    assert "already mapped to project PRJ-1" in response.json()["detail"]


async def test_approve_rejects_when_oracle_id_got_mapped_meanwhile(client, override_auth, monkeypatch):
    async def blocked(db, ids, **kwargs):
        return {"ORA-1": "Oracle Project ID ORA-1 is already mapped to project PRJ-9 - Y (Draft)."}

    monkeypatch.setattr("app.api.v1.endpoints.project_creation_requests.oracle_id_blockers", blocked)
    request = _fake_request()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(ProjectCreationRequest, _REQUEST_ID): request},
    )
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/approve",
        json={"reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 422
    assert request.status == "Pending"


# --- queue ----------------------------------------------------------------


async def test_list_requests_rejects_pm(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.get("/api/v1/project-creation-requests", headers=headers)
    assert response.status_code == 403


async def test_list_requests_allows_de_and_admin(client, override_auth):
    for role in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN):
        headers = override_auth(role)
        response = await client.get("/api/v1/project-creation-requests", headers=headers)
        assert response.status_code == 200
        assert response.json() == []


# --- approve / reject ---------------------------------------------------------


async def test_approve_rejects_pm(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/approve",
        json={"reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 403


async def test_approve_creates_draft_project_and_closes_request(client, override_auth):
    request = _fake_request()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(ProjectCreationRequest, _REQUEST_ID): request},
    )
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/approve",
        json={"reviewed_by": str(_REVIEWER_ID), "remarks": "ok"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    project = response.json()
    assert project["project_status"] == "Draft"
    assert project["project_name"] == "Core Banking Modernization"
    assert project["project_manager_id"] == str(_PM_ID)
    # The request is flipped to Approved and linked to the new project.
    assert request.status == "Approved"
    assert request.approved_project_id == UUID(project["id"])
    assert request.reviewed_by == _REVIEWER_ID


async def test_approve_404_when_request_missing(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={})
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/approve",
        json={"reviewed_by": str(_REVIEWER_ID)},
        headers=headers,
    )
    assert response.status_code == 404


async def test_reject_retains_request_as_rejected_with_remarks(client, override_auth):
    request = _fake_request()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(ProjectCreationRequest, _REQUEST_ID): request},
    )
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/reject",
        json={"reviewed_by": str(_REVIEWER_ID), "remarks": "Duplicate of PRJ-0042"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Rejected"
    assert body["review_remarks"] == "Duplicate of PRJ-0042"
    # The row is retained (not deleted) and stamped with the reviewer.
    assert request.status == "Rejected"
    assert request.reviewed_by == _REVIEWER_ID
    assert request.review_remarks == "Duplicate of PRJ-0042"


async def test_reject_requires_remarks(client, override_auth):
    request = _fake_request()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(ProjectCreationRequest, _REQUEST_ID): request},
    )
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/reject",
        json={"reviewed_by": str(_REVIEWER_ID), "remarks": ""},
        headers=headers,
    )
    assert response.status_code == 422


async def test_reject_404_when_request_missing(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={})
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/reject",
        json={"reviewed_by": str(_REVIEWER_ID), "remarks": "n/a"},
        headers=headers,
    )
    assert response.status_code == 404


async def test_reject_rejects_account_head(client, override_auth):
    headers = override_auth(RoleCode.ACCOUNT_MANAGER)
    response = await client.post(
        f"/api/v1/project-creation-requests/{_REQUEST_ID}/reject",
        json={"reviewed_by": str(_REVIEWER_ID), "remarks": "no"},
        headers=headers,
    )
    assert response.status_code == 403
