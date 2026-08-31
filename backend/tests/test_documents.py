from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_list_documents_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/documents")
    assert response.status_code == 401


async def test_list_documents_returns_200_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/documents", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_delete_document_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.delete(f"/api/v1/projects/{_PROJECT_ID}/documents/{uuid4()}", headers=headers)
    assert response.status_code == 403


async def test_delete_document_passes_pm_or_admin_gate(client, override_auth):
    # No FakeDB-seeded document, so this 404s once past the role gate —
    # proves the gate let an allowed role through without asserting a full
    # delete round trip (FakeDB has no real storage to delete from).
    headers = override_auth(RoleCode.ADMIN)
    response = await client.delete(f"/api/v1/projects/{_PROJECT_ID}/documents/{uuid4()}", headers=headers)
    assert response.status_code == 404
