from uuid import uuid4

import pytest

from app.models.reference_data import Account
from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

_ACCOUNT_ID = uuid4()
_URL = f"/api/v1/accounts/{_ACCOUNT_ID}/customer-communications"


async def test_list_requires_auth(client):
    assert (await client.get(_URL)).status_code == 401


async def test_list_rejects_unrelated_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    assert (await client.get(_URL, headers=headers)).status_code == 403


@pytest.mark.parametrize("role", [RoleCode.ADMIN, RoleCode.CDO, RoleCode.DELIVERY_EXCELLENCE])
async def test_list_returns_empty_for_cross_portfolio_roles(client, override_auth, role):
    headers = override_auth(role)
    response = await client.get(_URL, headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_rejects_cdo(client, override_auth):
    headers = override_auth(RoleCode.CDO)
    response = await client.post(
        _URL,
        data={"reporting_date": "2026-09-15", "title": "Q3 Account Review"},
        files={"file": ("deck.pptx", b"x")},
        headers=headers,
    )
    assert response.status_code == 403


async def test_create_rejects_disallowed_file_type(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    response = await client.post(
        _URL,
        data={"reporting_date": "2026-09-15", "title": "Q3 Account Review"},
        files={"file": ("notes.txt", b"x")},
        headers=headers,
    )
    assert response.status_code == 400
    assert "allowed" in response.json()["detail"]


async def test_create_requires_title_and_file(client, override_auth):
    headers = override_auth(RoleCode.ADMIN, get_map={(Account, _ACCOUNT_ID): object()})
    response = await client.post(_URL, data={"reporting_date": "2026-09-15"}, headers=headers)
    assert response.status_code == 422
