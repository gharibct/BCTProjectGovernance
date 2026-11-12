import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

URL = "/api/v1/users/login-details"


async def test_login_details_requires_auth(client):
    assert (await client.get(URL)).status_code == 401


async def test_login_details_rejects_non_de_roles(client, override_auth):
    for role in (RoleCode.PROJECT_MANAGER, RoleCode.TEAM_MEMBER, RoleCode.PMO, RoleCode.GEO_HEAD):
        headers = override_auth(role)
        assert (await client.get(URL, headers=headers)).status_code == 403


async def test_login_details_allows_de_and_admin(client, override_auth):
    for role in (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN):
        headers = override_auth(role)
        response = await client.get(f"{URL}?never_logged_in=true", headers=headers)
        assert response.status_code == 200
        assert "items" in response.json()
