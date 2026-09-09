"""users.py — create/update/delete on the /users sub-router are admin-gated,
but the list/get routes and the hand-written /roles + /users list stay open to
every authenticated caller (assignee/owner dropdowns need them). The /users
list route is hand-written (not the generic factory one) to add server-side
`search` / `is_active` / `role_code` / `ids` params for the 2000+-employee
person pickers. test_authorization.py covers accounts/geos end-to-end; this
file covers the plain list endpoints and the new query params.

FakeDB has no storage, so these assert wiring / param parsing / status codes,
not filtered result data.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.reference_data import Account, Geo
from app.models.users import User
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_list_users_requires_auth(client):
    response = await client.get("/api/v1/users")
    assert response.status_code == 401


async def test_list_users_open_to_non_admin(client, override_auth):
    # Not admin-gated on read: owner/assignee pickers are used by every role.
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/users", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_list_users_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get("/api/v1/users", headers=headers)
    assert response.status_code == 200
    assert "items" in response.json()


async def test_list_users_accepts_search(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/users?search=an&limit=20", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["limit"] == 20


async def test_list_users_accepts_is_active(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/users?is_active=true", headers=headers)
    assert response.status_code == 200


async def test_list_users_accepts_role_code(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(
        "/api/v1/users?role_code=DELIVERY_EXCELLENCE", headers=headers
    )
    assert response.status_code == 200


async def test_list_users_rejects_unknown_role_code(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/users?role_code=NOPE", headers=headers)
    assert response.status_code == 422


async def test_list_users_accepts_repeated_role_code(client, override_auth):
    # PM / Account Head pickers pass several roles — a user matches any of them.
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(
        "/api/v1/users?role_code=PROJECT_MANAGER&role_code=ACCOUNT_MANAGER&role_code=GEO_HEAD",
        headers=headers,
    )
    assert response.status_code == 200
    assert "items" in response.json()


async def test_list_users_resolves_by_ids(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(
        f"/api/v1/users?ids={uuid4()},{uuid4()}", headers=headers
    )
    assert response.status_code == 200
    assert response.json()["skip"] == 0


async def test_list_users_rejects_non_uuid_ids(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/users?ids=not-a-uuid", headers=headers)
    assert response.status_code == 422


async def test_list_users_empty_ids_returns_empty_page(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/users?ids=", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_list_roles_open_to_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/roles", headers=headers)
    assert response.status_code == 200


async def test_list_roles_passes_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get("/api/v1/roles", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_user_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post("/api/v1/users", json={}, headers=headers)
    assert response.status_code == 403


async def test_get_user_not_found_returns_404_for_admin(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.get(f"/api/v1/users/{uuid4()}", headers=headers)
    assert response.status_code == 404


# --- local password admin (AUTH_TYPE=password) ---------------------------


async def test_set_password_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    response = await client.put(
        f"/api/v1/users/{uuid4()}/password", json={"password": "longenough1"}, headers=headers
    )
    assert response.status_code == 403


async def test_set_password_rejects_short_password(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/users/{uuid4()}/password", json={"password": "short"}, headers=headers
    )
    assert response.status_code == 422


async def test_set_password_unknown_user_is_404(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/users/{uuid4()}/password", json={"password": "longenough1"}, headers=headers
    )
    assert response.status_code == 404


async def test_set_password_hashes_and_stores(client, override_auth):
    uid = uuid4()
    user = SimpleNamespace(id=uid, password_hash=None)
    headers = override_auth(RoleCode.ADMIN, get_map={(User, uid): user})
    response = await client.put(
        f"/api/v1/users/{uid}/password", json={"password": "longenough1"}, headers=headers
    )
    assert response.status_code == 204
    assert user.password_hash and user.password_hash.startswith("scrypt$")


async def test_clear_password_sets_hash_to_none(client, override_auth):
    uid = uuid4()
    user = SimpleNamespace(id=uid, password_hash="scrypt$32768$8$1$abc$def")
    headers = override_auth(RoleCode.ADMIN, get_map={(User, uid): user})
    response = await client.delete(f"/api/v1/users/{uid}/password", headers=headers)
    assert response.status_code == 204
    assert user.password_hash is None


# --- Account Head / Geo Head assignment (Admin creation screens) ---------


async def test_set_account_head_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.GEO_HEAD)
    response = await client.put(
        f"/api/v1/accounts/{uuid4()}/account-head", json={"user_id": str(uuid4())}, headers=headers
    )
    assert response.status_code == 403


async def test_set_account_head_unknown_account_is_404(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/accounts/{uuid4()}/account-head", json={"user_id": None}, headers=headers
    )
    assert response.status_code == 404


async def test_set_account_head_clears_with_null(client, override_auth):
    aid = uuid4()
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, aid): SimpleNamespace(id=aid)})
    response = await client.put(
        f"/api/v1/accounts/{aid}/account-head", json={"user_id": None}, headers=headers
    )
    assert response.status_code == 200
    assert response.json() is None


async def test_set_geo_head_rejects_non_admin(client, override_auth):
    headers = override_auth(RoleCode.GEO_HEAD)
    response = await client.put(
        f"/api/v1/geos/{uuid4()}/geo-head", json={"user_id": str(uuid4())}, headers=headers
    )
    assert response.status_code == 403


async def test_set_geo_head_unknown_geo_is_404(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/geos/{uuid4()}/geo-head", json={"user_id": None}, headers=headers
    )
    assert response.status_code == 404


async def test_set_geo_head_ok_for_admin(client, override_auth):
    gid = uuid4()
    headers = override_auth(RoleCode.ADMIN, get_map={(Geo, gid): SimpleNamespace(id=gid)})
    response = await client.put(
        f"/api/v1/geos/{gid}/geo-head", json={"user_id": None}, headers=headers
    )
    assert response.status_code == 200
