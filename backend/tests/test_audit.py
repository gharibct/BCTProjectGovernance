import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


async def test_list_activity_log_requires_auth(client):
    response = await client.get("/api/v1/audit-log")
    assert response.status_code == 401


async def test_list_activity_log_returns_200_for_any_role(client, override_auth):
    # Read-only module — no write endpoints, so no role-gate test needed.
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/audit-log", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "skip": 0, "limit": 50}
