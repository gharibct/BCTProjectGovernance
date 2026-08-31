from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models.actions import Action
from app.models.reference_data import Account
from app.models.projects import Project
from app.schemas.enums import RoleCode
from tests.test_authorization import FakeDB, make_user

pytestmark = pytest.mark.asyncio

_GEO_ID = uuid4()
_ACCOUNT_ID = uuid4()
_PROJECT_ID = uuid4()


def _make_action(**overrides):
    defaults = {
        "id": uuid4(),
        "action_code": "ACT-2026-0001",
        "level": "ACCOUNT",
        "level_value": str(_ACCOUNT_ID),
        "title": "Test action",
        "description": None,
        "action_by_id": uuid4(),
        "priority": "HIGH",
        "status": "IN_PROGRESS",
        "due_date": date.today(),
        "raised_by": uuid4(),
        "raised_at": datetime.now(UTC),
        "completed_at": None,
        "closed_at": None,
        "closed_by": None,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    defaults.update(overrides)
    return type("FakeAction", (), defaults)()


def _override(current_user, fake_db):
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.dependency_overrides[get_db] = lambda: fake_db
    from app.core.config import settings

    return {"X-API-Key": settings.api_key}


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


# --- List (open to any authenticated user, all three levels) ---


@pytest.mark.parametrize(
    "prefix,entity_id",
    [("geos", _GEO_ID), ("accounts", _ACCOUNT_ID), ("projects", _PROJECT_ID)],
)
async def test_list_actions_returns_200_for_any_role(client, prefix, entity_id):
    headers = _override(make_user(), FakeDB(RoleCode.TEAM_MEMBER))
    response = await client.get(f"/api/v1/{prefix}/{entity_id}/actions", headers=headers)
    assert response.status_code == 200


async def test_list_actions_requires_auth(client):
    response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/actions")
    assert response.status_code == 401


# --- Create: open to any authenticated user at any level (no write gate) ---


@pytest.mark.parametrize(
    "prefix,entity_id",
    [("geos", _GEO_ID), ("accounts", _ACCOUNT_ID), ("projects", _PROJECT_ID)],
)
async def test_create_action_allows_any_role_at_any_level(client, prefix, entity_id):
    # A TEAM_MEMBER with no owned geos/accounts still gets past authorization;
    # the empty body then fails ActionCreate's required fields, so a request
    # that cleared the (now removed) gate shows up as 422, never 403.
    headers = _override(make_user(), FakeDB(RoleCode.TEAM_MEMBER))
    response = await client.post(f"/api/v1/{prefix}/{entity_id}/actions", json={}, headers=headers)
    assert response.status_code == 422


async def test_create_action_still_requires_auth(client):
    response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/actions", json={})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "prefix,entity_id",
    [("geos", _GEO_ID), ("accounts", _ACCOUNT_ID), ("projects", _PROJECT_ID)],
)
async def test_create_action_succeeds_for_team_member_with_valid_payload(client, prefix, entity_id):
    user = make_user()
    headers = _override(user, FakeDB(RoleCode.TEAM_MEMBER))
    payload = {"title": "Do the thing", "priority": "HIGH", "due_date": "2026-12-01"}
    response = await client.post(f"/api/v1/{prefix}/{entity_id}/actions", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["action_by_id"] == str(user.id)


# --- Create: default-owner resolution (Geo Owner / Account Head / PM) ---


async def test_create_project_action_defaults_owner_to_project_manager(client):
    pm_id = uuid4()
    project = type("FakeProject", (), {"project_manager_id": pm_id})()
    headers = _override(
        make_user(),
        FakeDB(RoleCode.PROJECT_MANAGER, get_map={(Project, _PROJECT_ID): project}),
    )
    payload = {"title": "Do the thing", "priority": "HIGH", "due_date": "2026-12-01"}
    response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/actions", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["action_by_id"] == str(pm_id)


async def test_create_geo_action_defaults_owner_to_geo_head(client):
    geo_head_id = uuid4()
    # FakeDB can't tell the "who is the geo head" user_geos read apart from the
    # scope read, so it answers both from owned_geo_ids — enough to prove the
    # resolved id becomes the action owner.
    headers = _override(make_user(), FakeDB(RoleCode.GEO_HEAD, owned_geo_ids=[geo_head_id]))
    payload = {"title": "Do the thing", "priority": "HIGH", "due_date": "2026-12-01"}
    response = await client.post(f"/api/v1/geos/{_GEO_ID}/actions", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["action_by_id"] == str(geo_head_id)


async def test_create_account_action_defaults_owner_to_account_head(client):
    account_head_id = uuid4()
    headers = _override(make_user(), FakeDB(RoleCode.ACCOUNT_MANAGER, owned_account_ids=[account_head_id]))
    payload = {"title": "Do the thing", "priority": "HIGH", "due_date": "2026-12-01"}
    response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/actions", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["action_by_id"] == str(account_head_id)


async def test_create_action_falls_back_to_creator_when_no_head_mapped(client):
    user = make_user()
    # No owned_account_ids -> no Account Head resolves -> creator is the owner.
    headers = _override(user, FakeDB(RoleCode.ACCOUNT_MANAGER))
    payload = {"title": "Do the thing", "priority": "HIGH", "due_date": "2026-12-01"}
    response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/actions", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["action_by_id"] == str(user.id)


async def test_create_account_action_honors_explicit_owner(client):
    explicit_owner = uuid4()
    headers = _override(make_user(), FakeDB(RoleCode.ACCOUNT_MANAGER, owned_account_ids=[_ACCOUNT_ID]))
    payload = {
        "title": "Do the thing",
        "priority": "HIGH",
        "due_date": "2026-12-01",
        "action_by_id": str(explicit_owner),
    }
    response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/actions", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["action_by_id"] == str(explicit_owner)


# --- Transitions: ownership bypass + state machine ---


async def test_start_action_rejects_non_owner_non_manager(client):
    action_id = uuid4()
    action = _make_action(action_by_id=uuid4(), status="OPEN")
    headers = _override(make_user(), FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.patch(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/start", headers=headers)
    assert response.status_code == 403


async def test_start_action_allows_owner_regardless_of_role(client):
    owner = make_user()
    action_id = uuid4()
    action = _make_action(action_by_id=owner.id, status="OPEN")
    headers = _override(owner, FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.patch(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/start", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "IN_PROGRESS"


async def test_complete_action_rejects_from_closed(client):
    owner = make_user()
    action_id = uuid4()
    action = _make_action(action_by_id=owner.id, status="CLOSED")
    headers = _override(owner, FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.patch(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/complete", headers=headers)
    assert response.status_code == 400


async def test_close_action_rejects_before_completed(client):
    owner = make_user()
    action_id = uuid4()
    action = _make_action(action_by_id=owner.id, status="IN_PROGRESS")
    headers = _override(owner, FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.patch(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/close", headers=headers)
    assert response.status_code == 400


async def test_close_action_allows_after_completed(client):
    owner = make_user()
    action_id = uuid4()
    action = _make_action(action_by_id=owner.id, status="COMPLETED")
    headers = _override(owner, FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.patch(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/close", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "CLOSED"
    assert response.json()["closed_by"] == str(owner.id)


async def test_cancel_action_allows_from_open(client):
    owner = make_user()
    action_id = uuid4()
    action = _make_action(action_by_id=owner.id, status="OPEN")
    headers = _override(owner, FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.patch(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/cancel", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"


async def test_cancel_action_rejects_after_completed(client):
    owner = make_user()
    action_id = uuid4()
    action = _make_action(action_by_id=owner.id, status="COMPLETED")
    headers = _override(owner, FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.patch(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/cancel", headers=headers)
    assert response.status_code == 400


# --- Comments ---


async def test_add_comment_rejects_non_owner_non_manager(client):
    action_id = uuid4()
    action = _make_action(action_by_id=uuid4())
    headers = _override(make_user(), FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.post(
        f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/comments", json={"text": "hi"}, headers=headers
    )
    assert response.status_code == 403


async def test_add_comment_allows_owner(client):
    owner = make_user()
    action_id = uuid4()
    action = _make_action(action_by_id=owner.id)
    headers = _override(owner, FakeDB(RoleCode.TEAM_MEMBER, get_map={(Action, action_id): action}))
    response = await client.post(
        f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}/comments", json={"text": "progress note"}, headers=headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["event_type"] == "COMMENT"
    assert body["comment"] == "progress note"
    assert body["created_by"] == str(owner.id)


# --- Update: field-change history ---


async def test_update_action_logs_owner_and_due_date_changes(client):
    action_id = uuid4()
    old_owner = uuid4()
    action = _make_action(
        action_by_id=old_owner, due_date=date(2026, 1, 1), priority="LOW", level_value=str(_ACCOUNT_ID)
    )
    headers = _override(make_user(), FakeDB(RoleCode.ACCOUNT_MANAGER, owned_account_ids=[_ACCOUNT_ID], get_map={(Action, action_id): action}))
    new_owner = uuid4()
    payload = {"action_by_id": str(new_owner), "due_date": "2026-02-01"}
    response = await client.put(f"/api/v1/accounts/{_ACCOUNT_ID}/actions/{action_id}", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["action_by_id"] == str(new_owner)
    assert response.json()["due_date"] == "2026-02-01"
