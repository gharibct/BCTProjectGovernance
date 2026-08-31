from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_GEO_ID = uuid4()


async def test_list_requires_auth(client):
    response = await client.get(f"/api/v1/geos/{_GEO_ID}/executive-updates")
    assert response.status_code == 401


async def test_list_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/geos/{_GEO_ID}/executive-updates", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_create_rejects_wrong_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.post(f"/api/v1/geos/{_GEO_ID}/executive-updates", json={}, headers=headers)
    assert response.status_code == 403


async def test_create_passes_geo_head_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.post(f"/api/v1/geos/{_GEO_ID}/executive-updates", json={}, headers=headers)
    assert response.status_code != 403
