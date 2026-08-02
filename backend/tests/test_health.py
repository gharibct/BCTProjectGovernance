"""Smoke tests that don't require a live Postgres. Everything under /api/v1
needs a real database — see the README section on running integration tests
against db/tables/run_all.sql once Postgres is available.
"""

import pytest

pytestmark = pytest.mark.asyncio


async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_protected_route_requires_api_key(client):
    response = await client.get("/api/v1/roles")
    assert response.status_code == 401


async def test_protected_route_passes_auth_with_valid_api_key(client):
    """No Postgres is reachable in this environment, so a valid-key request
    fails when the route handler tries to open a DB connection — proving it
    got past the X-API-Key check instead of being rejected at auth (401)."""
    from app.core.config import settings

    with pytest.raises(Exception, match="onnect"):
        await client.get("/api/v1/roles", headers={"X-API-Key": settings.api_key})
