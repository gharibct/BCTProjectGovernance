"""Smoke tests that don't require a live database. Everything under
/api/v1 (except /api/v1/auth/*) needs both the shared API key and a valid
session — see app/main.py. Fuller integration coverage runs against a seeded
SQLite/Postgres db (see scripts/pre-release-check.ps1).
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


async def test_protected_route_still_requires_session_with_valid_api_key(client):
    """The authorization hardening (commit a6c607e) put a second gate on the
    main API router: a valid X-API-Key alone is no longer enough — every
    /api/v1/* route outside /auth also needs a session cookie, so this stays
    401 rather than falling through to the handler."""
    from app.core.config import settings

    response = await client.get("/api/v1/roles", headers={"X-API-Key": settings.api_key})
    assert response.status_code == 401


async def test_auth_config_route_needs_only_the_api_key(client):
    """/api/v1/auth/* is mounted without the session gate so login is
    reachable. GET /auth/config touches no database, so a valid key returns
    200 and a missing key is rejected at 401."""
    from app.core.config import settings

    assert (await client.get("/api/v1/auth/config")).status_code == 401
    ok = await client.get("/api/v1/auth/config", headers={"X-API-Key": settings.api_key})
    assert ok.status_code == 200
