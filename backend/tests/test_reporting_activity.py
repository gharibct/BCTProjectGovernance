"""GET /projects/{id}/reporting-activity + the pure classification behind it
(services/reporting_activity)."""

from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.schemas.enums import ReportStatus, RoleCode
from app.services.reporting_activity import _series
from tests.test_authorization import override_auth

_PROJECT_ID = uuid4()
_TODAY = date(2026, 8, 20)


def _period(pid, start, end):
    return SimpleNamespace(id=pid, label=f"W {start}", start_date=start, end_date=end, period_type="Weekly")


def _report(pid, status, updated):
    return SimpleNamespace(period_id=pid, status=status, updated_at=updated)


# --- endpoint ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_requires_auth(client):
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/reporting-activity")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_returns_shape_for_any_role(client, override_auth):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/projects/{_PROJECT_ID}/reporting-activity", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"year", "weekly", "monthly"}
    for series in (body["weekly"], body["monthly"]):
        assert set(series) == {"items", "counts", "pct"}
        assert set(series["counts"]) == {
            "on_time",
            "late",
            "pending",
            "not_applicable",
            "submitted",
            "total",
        }


# --- classification -------------------------------------------------------


def test_series_buckets_and_counts():
    p1, p2, p3, p4 = uuid4(), uuid4(), uuid4(), uuid4()
    periods = [
        _period(p1, date(2026, 8, 3), date(2026, 8, 9)),
        _period(p2, date(2026, 8, 10), date(2026, 8, 16)),
        _period(p3, date(2026, 8, 17), date(2026, 8, 23)),
        _period(p4, date(2026, 8, 24), date(2026, 8, 30)),  # starts after _TODAY -> n/a (future)
    ]
    reports = {
        # submitted within the period window -> on-time
        p2: _report(p2, ReportStatus.SUBMITTED, datetime(2026, 8, 12, tzinfo=timezone.utc)),
        # submitted after the period end -> late
        p1: _report(p1, ReportStatus.SUBMITTED, datetime(2026, 8, 12, tzinfo=timezone.utc)),
        # a draft is not "submitted" -> pending
        p3: _report(p3, ReportStatus.DRAFT, datetime(2026, 8, 20, tzinfo=timezone.utc)),
    }

    series = _series(periods, reports, scope_start=None, window_end=_TODAY)

    assert [i.status for i in series.items] == ["late", "on-time", "pending", "n/a"]
    assert [i.period_id for i in series.items] == [p1, p2, p3, p4]  # chronological
    assert series.counts.on_time == 1
    assert series.counts.late == 1
    assert series.counts.pending == 1
    assert series.counts.not_applicable == 1
    assert series.counts.submitted == 2
    assert series.counts.total == 3  # in-window only, the future period is excluded
    assert series.pct == 67
    assert series.items[3].has_report is False


def test_series_excludes_periods_before_project_start():
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    periods = [
        _period(p1, date(2026, 1, 5), date(2026, 1, 11)),  # before project start -> n/a
        _period(p2, date(2026, 8, 3), date(2026, 8, 9)),  # in window, unsubmitted -> pending
        _period(p3, date(2026, 8, 10), date(2026, 8, 16)),  # in window, unsubmitted -> pending
    ]

    series = _series(periods, {}, scope_start=date(2026, 8, 1), window_end=_TODAY)

    assert [i.status for i in series.items] == ["n/a", "pending", "pending"]
    assert series.counts.not_applicable == 1
    assert series.counts.pending == 2
    assert series.counts.total == 2
    assert series.pct == 0


def test_series_excludes_periods_after_project_end():
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    periods = [
        _period(p1, date(2026, 8, 3), date(2026, 8, 9)),  # in window -> pending
        _period(p2, date(2026, 8, 10), date(2026, 8, 16)),  # in window -> pending
        _period(p3, date(2026, 8, 17), date(2026, 8, 23)),  # starts after the project ended -> n/a
    ]

    # project ended 2026-08-15, before _TODAY (2026-08-20) -> window_end = 08-15
    series = _series(periods, {}, scope_start=date(2026, 1, 1), window_end=date(2026, 8, 15))

    assert [i.status for i in series.items] == ["pending", "pending", "n/a"]
    assert series.counts.total == 2
    assert series.counts.not_applicable == 1


def test_series_empty():
    series = _series([], {}, scope_start=None, window_end=_TODAY)
    assert series.counts.total == 0
    assert series.counts.not_applicable == 0
    assert series.pct == 0
    assert series.items == []


# --- account / geo weekly-only endpoints ---------------------------------

_ACCOUNT_ID = uuid4()
_GEO_ID = uuid4()


@pytest.mark.asyncio
@pytest.mark.parametrize("path", [f"accounts/{_ACCOUNT_ID}", f"geos/{_GEO_ID}"])
async def test_regional_activity_requires_auth(client, path):
    response = await client.get(f"/api/v1/{path}/reporting-activity")
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("path", [f"accounts/{_ACCOUNT_ID}", f"geos/{_GEO_ID}"])
async def test_regional_activity_weekly_only_shape(client, override_auth, path):
    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get(f"/api/v1/{path}/reporting-activity", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"year", "weekly"}  # no "monthly"
    assert set(body["weekly"]) == {"items", "counts", "pct"}
