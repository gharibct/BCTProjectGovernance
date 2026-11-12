from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.reference_data import Account
from app.models.users import Role, User
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_ACCOUNT_ID = uuid4()
_DE_ID = uuid4()
_URL = "/api/v1/de-account-allocation"


def _account(**overrides):
    now = datetime.now(UTC)
    defaults = dict(
        id=_ACCOUNT_ID,
        name="Acme",
        geo_id=None,
        region_id=None,
        is_active=True,
        critical_flag="No",
        delivery_excellence_id=None,
        de_allocated_at=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _de_user(role_code=RoleCode.DELIVERY_EXCELLENCE, is_active=True):
    role = Role(id=uuid4(), code=role_code, name=role_code)
    user = SimpleNamespace(id=_DE_ID, role_id=role.id, is_active=is_active, full_name="Dee Eee")
    return user, role


def _body(de_id=_DE_ID):
    return {"assignments": [{"account_id": str(_ACCOUNT_ID), "delivery_excellence_id": str(de_id) if de_id else None}]}


async def test_list_requires_auth(client):
    assert (await client.get(_URL)).status_code == 401


async def test_list_rejects_non_de(client, override_auth):
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.PMO):
        assert (await client.get(_URL, headers=override_auth(role))).status_code == 403


async def test_list_allows_de_and_admin(client, override_auth):
    for role in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN):
        response = await client.get(_URL, headers=override_auth(role))
        assert response.status_code == 200
        assert response.json() == []


async def test_list_filter_values(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    for value in ("unallocated", "allocated", "all"):
        assert (await client.get(f"{_URL}?allocation={value}", headers=headers)).status_code == 200
    assert (await client.get(f"{_URL}?allocation=bogus", headers=headers)).status_code == 422


async def test_bulk_rejects_non_de(client, override_auth):
    headers = override_auth(RoleCode.PROJECT_MANAGER)
    assert (await client.patch(f"{_URL}/allocations", json=_body(), headers=headers)).status_code == 403


async def test_bulk_sets_de_and_timestamp(client, override_auth):
    account = _account()
    user, role = _de_user()
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(Account, _ACCOUNT_ID): account, (User, _DE_ID): user, (Role, user.role_id): role},
    )
    response = await client.patch(f"{_URL}/allocations", json=_body(), headers=headers)
    assert response.status_code == 200
    assert account.delivery_excellence_id == _DE_ID
    assert account.de_allocated_at is not None


async def test_bulk_clears_allocation(client, override_auth):
    account = _account(delivery_excellence_id=_DE_ID, de_allocated_at=datetime.now(UTC))
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): account})
    response = await client.patch(f"{_URL}/allocations", json=_body(None), headers=headers)
    assert response.status_code == 200
    assert account.delivery_excellence_id is None
    assert account.de_allocated_at is None


async def test_bulk_rejects_non_de_target(client, override_auth):
    account = _account()
    user, role = _de_user(role_code=RoleCode.PROJECT_MANAGER)
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(Account, _ACCOUNT_ID): account, (User, _DE_ID): user, (Role, user.role_id): role},
    )
    response = await client.patch(f"{_URL}/allocations", json=_body(), headers=headers)
    assert response.status_code == 400
    assert account.delivery_excellence_id is None


async def test_bulk_rejects_inactive_target_user(client, override_auth):
    account = _account()
    user, role = _de_user(is_active=False)
    headers = override_auth(
        RoleCode.DELIVERY_EXCELLENCE,
        get_map={(Account, _ACCOUNT_ID): account, (User, _DE_ID): user, (Role, user.role_id): role},
    )
    assert (await client.patch(f"{_URL}/allocations", json=_body(), headers=headers)).status_code == 400


async def test_bulk_rejects_missing_or_inactive_account(client, override_auth):
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE)
    assert (await client.patch(f"{_URL}/allocations", json=_body(), headers=headers)).status_code == 404
    inactive = _account(is_active=False)
    headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map={(Account, _ACCOUNT_ID): inactive})
    assert (await client.patch(f"{_URL}/allocations", json=_body(), headers=headers)).status_code == 404
