"""Covers health_declarations.py, geo_health_declarations.py and
account_health_declarations.py — three routers sharing one shape (list +
latest + create/edit), scoped to project/geo/account respectively.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.projects import Project
from app.schemas.enums import Category, RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio


class TestProjectHealthDeclarations:
    _PROJECT_ID = uuid4()
    _PROJECT_GET_MAP = {(Project, _PROJECT_ID): SimpleNamespace(account_id=None, geo_id=None)}

    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/projects/{self._PROJECT_ID}/health-declarations")
        assert response.status_code == 401

    async def test_list_returns_200_for_de_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map=self._PROJECT_GET_MAP)
        response = await client.get(f"/api/v1/projects/{self._PROJECT_ID}/health-declarations", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER, get_map=self._PROJECT_GET_MAP)
        response = await client.get(f"/api/v1/projects/{self._PROJECT_ID}/health-declarations", headers=headers)
        assert response.status_code == 403

    async def test_create_rejects_non_pm_admin(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/projects/{self._PROJECT_ID}/health-declarations", json={}, headers=headers
        )
        assert response.status_code == 403

    async def test_create_passes_pm_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(
            f"/api/v1/projects/{self._PROJECT_ID}/health-declarations", json={}, headers=headers
        )
        assert response.status_code != 403

    async def test_list_health_items_returns_200(self, client, override_auth):
        headers = override_auth(RoleCode.DELIVERY_EXCELLENCE, get_map=self._PROJECT_GET_MAP)
        response = await client.get(
            f"/api/v1/projects/{self._PROJECT_ID}/health-items",
            params={"period_id": str(uuid4()), "category": Category.CORE_DELIVERY.value},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == []


class TestGeoHealthDeclarations:
    _GEO_ID = uuid4()

    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/geos/{self._GEO_ID}/health-declarations")
        assert response.status_code == 401

    async def test_list_returns_200_for_cdo_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.CDO)
        response = await client.get(f"/api/v1/geos/{self._GEO_ID}/health-declarations", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(f"/api/v1/geos/{self._GEO_ID}/health-declarations", headers=headers)
        assert response.status_code == 403

    async def test_create_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(f"/api/v1/geos/{self._GEO_ID}/health-declarations", json={}, headers=headers)
        assert response.status_code == 403

    async def test_create_passes_geo_head_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(f"/api/v1/geos/{self._GEO_ID}/health-declarations", json={}, headers=headers)
        assert response.status_code != 403


class TestAccountHealthDeclarations:
    _ACCOUNT_ID = uuid4()

    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/accounts/{self._ACCOUNT_ID}/health-declarations")
        assert response.status_code == 401

    async def test_list_returns_200_for_admin_regardless_of_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.get(f"/api/v1/accounts/{self._ACCOUNT_ID}/health-declarations", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_rejects_team_member_with_no_ownership(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(f"/api/v1/accounts/{self._ACCOUNT_ID}/health-declarations", headers=headers)
        assert response.status_code == 403

    async def test_create_rejects_wrong_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(
            f"/api/v1/accounts/{self._ACCOUNT_ID}/health-declarations", json={}, headers=headers
        )
        assert response.status_code == 403

    async def test_create_passes_account_manager_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(
            f"/api/v1/accounts/{self._ACCOUNT_ID}/health-declarations", json={}, headers=headers
        )
        assert response.status_code != 403

    async def test_list_health_items_returns_200(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.get(
            f"/api/v1/accounts/{self._ACCOUNT_ID}/health-items",
            params={"period_id": str(uuid4()), "category": Category.CORE_DELIVERY.value},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json() == []
