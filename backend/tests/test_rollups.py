"""Covers regional_status.py (Account/Geo Reporting status reports + items),
account_rollup.py, account_health_rollup.py and geo_rollup.py.
"""

from uuid import uuid4

import pytest

from app.schemas.enums import ProjectStatusCategory, RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_ACCOUNT_ID = uuid4()
_GEO_ID = uuid4()


class TestAccountStatusReports:
    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports")
        assert response.status_code == 401

    async def test_list_returns_200_for_any_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_create_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports", json={}, headers=headers)
        assert response.status_code == 403

    async def test_create_passes_account_manager_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports", json={}, headers=headers)
        assert response.status_code != 403

    async def test_review_rejects_wrong_role(self, client, override_auth):
        # Gated by require_account_geo_scope(GEO_HEAD, ADMIN).
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.patch(
            f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
        )
        assert response.status_code == 403

    async def test_review_passes_geo_head_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.patch(
            f"/api/v1/accounts/{_ACCOUNT_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
        )
        assert response.status_code != 403

    async def test_list_status_items_returns_200(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/status-items",
            params={"period_id": str(uuid4()), "category": ProjectStatusCategory.KEY_ACCOMPLISHMENTS.value},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == []


class TestGeoStatusReports:
    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/geos/{_GEO_ID}/status-reports")
        assert response.status_code == 401

    async def test_list_returns_200_for_any_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(f"/api/v1/geos/{_GEO_ID}/status-reports", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_create_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(f"/api/v1/geos/{_GEO_ID}/status-reports", json={}, headers=headers)
        assert response.status_code == 403

    async def test_create_passes_geo_head_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(f"/api/v1/geos/{_GEO_ID}/status-reports", json={}, headers=headers)
        assert response.status_code != 403

    async def test_review_rejects_wrong_role(self, client, override_auth):
        # Gated by require_role(CXO, ADMIN) — no ownership scoping.
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.patch(
            f"/api/v1/geos/{_GEO_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
        )
        assert response.status_code == 403

    async def test_review_passes_cxo_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.CXO)
        response = await client.patch(
            f"/api/v1/geos/{_GEO_ID}/status-reports/{uuid4()}/review", json={}, headers=headers
        )
        assert response.status_code != 403


class TestAccountRollup:
    async def test_get_requires_auth(self, client):
        response = await client.get(f"/api/v1/accounts/{_ACCOUNT_ID}/rollup", params={"period_id": str(uuid4())})
        assert response.status_code == 401

    async def test_get_returns_200_for_any_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 200
        assert response.json() == {
            "metrics": {
                "revenue": None,
                "onsite_fte": None,
                "offshore_fte": None,
                "projects_count": None,
                "contributing_project_count": 0,
            },
            "items": [],
        }

    async def test_pull_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/accounts/{_ACCOUNT_ID}/rollup/pull", json={"project_item_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 403

    async def test_pull_passes_account_manager_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(
            f"/api/v1/accounts/{_ACCOUNT_ID}/rollup/pull", json={"project_item_id": str(uuid4())}, headers=headers
        )
        assert response.status_code != 403


class TestAccountHealthRollup:
    async def test_get_returns_200_for_any_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/accounts/{_ACCOUNT_ID}/health-rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 200
        assert response.json() == {"items": []}

    async def test_pull_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/accounts/{_ACCOUNT_ID}/health-rollup/pull",
            json={"project_item_id": str(uuid4())},
            headers=headers,
        )
        assert response.status_code == 403


class TestGeoRollup:
    async def test_get_returns_200_for_any_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/geos/{_GEO_ID}/rollup", params={"period_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 200
        assert response.json() == {
            "metrics": {
                "revenue": None,
                "onsite_fte": None,
                "offshore_fte": None,
                "projects_count": None,
                "contributing_account_count": 0,
            },
            "items": [],
        }

    async def test_pull_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/geos/{_GEO_ID}/rollup/pull", json={"account_item_id": str(uuid4())}, headers=headers
        )
        assert response.status_code == 403
