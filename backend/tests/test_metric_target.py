"""Metric Targets are a get-or-404 / upsert pair keyed by project_id (no list
endpoint — see metric_target.py's module docstring), so unlike the other
modules here the "happy path" for an authenticated caller is a clean 404
(no target set yet) rather than a 200 with an empty page.
"""

from uuid import uuid4

import pytest

from app.schemas.enums import RoleCode
from app.services.metric_reference import metric_range_errors
from tests.test_authorization import override_auth

pytestmark = pytest.mark.asyncio

_PROJECT_ID = uuid4()


async def test_get_development_target_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development")
    assert response.status_code == 401


async def test_get_development_target_404s_for_any_role_when_unset(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development", headers=headers)
    assert response.status_code == 404


async def test_upsert_development_target_rejects_non_pm_admin(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development", json={}, headers=headers
    )
    assert response.status_code == 403


async def test_upsert_development_target_passes_pm_or_admin_gate(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development", json={}, headers=headers
    )
    assert response.status_code != 403


async def test_get_staffing_target_404s_for_any_role_when_unset(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/metric-targets/staffing", headers=headers)
    assert response.status_code == 404


# --- config min/max range validation ---------------------------------------


async def test_metric_range_errors_flags_above_and_below():
    keys = {"target_test_pass_rate_pct": "test_pass_rate_pct"}  # yaml: min 0, max 100
    assert metric_range_errors("DEVELOPMENT", keys, {"target_test_pass_rate_pct": 150}) == [
        "Test Pass Rate (%): 150 is above the maximum 100."
    ]
    assert metric_range_errors("DEVELOPMENT", keys, {"target_test_pass_rate_pct": -1}) == [
        "Test Pass Rate (%): -1 is below the minimum 0."
    ]
    assert metric_range_errors("DEVELOPMENT", keys, {"target_test_pass_rate_pct": 95}) == []


async def test_metric_range_errors_ignores_blank_bound_and_bad_input():
    # effort_variation_pct: min "-100", max "" -> only the lower bound applies.
    keys = {"target_effort_variation_pct": "effort_variation_pct"}
    assert metric_range_errors("DEVELOPMENT", keys, {"target_effort_variation_pct": 5000}) == []
    assert metric_range_errors("DEVELOPMENT", keys, {"target_effort_variation_pct": -250}) == [
        "Effort Variation: -250 is below the minimum -100."
    ]
    # None, non-numeric, unknown key / ref_code -> skipped, never raises.
    assert metric_range_errors("DEVELOPMENT", keys, {"target_effort_variation_pct": None}) == []
    assert metric_range_errors("DEVELOPMENT", {"x": "no_such_metric"}, {"x": 1}) == []
    assert metric_range_errors("NOPE", keys, {"target_effort_variation_pct": -250}) == []


async def test_upsert_development_target_rejects_out_of_range(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development",
        json={"target_test_pass_rate_pct": 150},
        headers=headers,
    )
    assert response.status_code == 422
    assert "maximum 100" in response.json()["detail"]


async def test_upsert_development_target_in_range_is_not_422(client, override_auth):
    headers = override_auth(RoleCode.ADMIN)
    response = await client.put(
        f"/api/v1/projects/{_PROJECT_ID}/metric-targets/development",
        json={"target_test_pass_rate_pct": 95},
        headers=headers,
    )
    assert response.status_code != 422
