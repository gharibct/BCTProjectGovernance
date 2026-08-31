"""Covers ai_suggestions.py (/ai-suggestions) and ai_row_suggestions.py
(/ai-row-suggestions) — same pending/ingest/ignore/resolve shape, one for
per-field suggestions and one for whole-row RAID candidates.
"""

from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()
_QUERY = {"screen": "project_profile", "period_id": str(uuid4())}


class TestAiFieldSuggestions:
    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/ai-suggestions", params=_QUERY)
        assert response.status_code == 401

    async def test_list_returns_200_for_any_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/ai-suggestions", params=_QUERY, headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_ingest_rejects_non_pm_admin(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/ai-suggestions", json={}, headers=headers)
        assert response.status_code == 403

    async def test_ingest_passes_pm_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/ai-suggestions", json={}, headers=headers)
        assert response.status_code != 403


class TestAiRowSuggestions:
    async def test_list_requires_auth(self, client):
        response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/ai-row-suggestions", params=_QUERY)
        assert response.status_code == 401

    async def test_list_returns_200_for_any_role(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.get(
            f"/api/v1/projects/{_PROJECT_ID}/ai-row-suggestions", params=_QUERY, headers=headers
        )
        assert response.status_code == 200
        assert response.json() == []

    async def test_ingest_rejects_non_pm_admin(self, client, override_auth):
        headers = override_auth(RoleCode.TEAM_MEMBER)
        response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/ai-row-suggestions", json={}, headers=headers)
        assert response.status_code == 403

    async def test_ingest_passes_pm_or_admin_gate(self, client, override_auth):
        headers = override_auth(RoleCode.ADMIN)
        response = await client.post(f"/api/v1/projects/{_PROJECT_ID}/ai-row-suggestions", json={}, headers=headers)
        assert response.status_code != 403
