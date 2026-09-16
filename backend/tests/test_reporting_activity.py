"""GET /projects/{id}/reporting-activity + the pure classification behind it
(services/reporting_activity)."""

from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.projects import Project
from app.models.reference_data import Account, Geo, ReportingPeriod
from app.schemas.enums import ReportStatus, RoleCode
from app.services.reporting_activity import _series, build_reporting_activity, build_weekly_reporting_activity
from tests.test_authorization import override_auth

_PROJECT_ID = uuid4()
_TODAY = date(2026, 8, 24)


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
        _period(p4, date(2026, 8, 24), date(2026, 8, 30)),  # hasn't ended by _TODAY -> n/a (still running)
    ]
    reports = {
        # submitted within the period window -> on-time
        p2: _report(p2, ReportStatus.SUBMITTED, datetime(2026, 8, 12, tzinfo=timezone.utc)),
        # submitted after the period end -> late
        p1: _report(p1, ReportStatus.SUBMITTED, datetime(2026, 8, 12, tzinfo=timezone.utc)),
        # a draft is not "submitted" -> pending
        p3: _report(p3, ReportStatus.DRAFT, datetime(2026, 8, 20, tzinfo=timezone.utc)),
    }

    series = _series(periods, reports, scope_start=None, window_end=_TODAY, today=_TODAY)

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

    series = _series(periods, {}, scope_start=date(2026, 8, 1), window_end=_TODAY, today=_TODAY)

    assert [i.status for i in series.items] == ["n/a", "pending", "pending"]
    assert series.counts.not_applicable == 1
    assert series.counts.pending == 2
    assert series.counts.total == 2
    assert series.pct == 0


def test_series_includes_period_overlapping_scope_start():
    p1, p2 = uuid4(), uuid4()
    periods = [
        _period(p1, date(2026, 8, 24), date(2026, 8, 30)),  # scope starts mid-period -> pending, not n/a
        _period(p2, date(2026, 8, 17), date(2026, 8, 23)),  # entirely before scope start -> n/a
    ]

    series = _series(
        periods, {}, scope_start=date(2026, 8, 30), window_end=date(2026, 9, 15), today=date(2026, 9, 15)
    )

    assert [i.status for i in series.items] == ["n/a", "pending"]  # chronological: p2, p1
    assert series.counts.pending == 1
    assert series.counts.not_applicable == 1


def test_series_excludes_periods_after_project_end():
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    periods = [
        _period(p1, date(2026, 8, 3), date(2026, 8, 9)),  # in window -> pending
        _period(p2, date(2026, 8, 10), date(2026, 8, 16)),  # in window -> pending
        _period(p3, date(2026, 8, 17), date(2026, 8, 23)),  # starts after the project ended -> n/a
    ]

    # project ended 2026-08-15, before _TODAY (2026-08-24) -> window_end = 08-15
    series = _series(periods, {}, scope_start=date(2026, 1, 1), window_end=date(2026, 8, 15), today=_TODAY)

    assert [i.status for i in series.items] == ["pending", "pending", "n/a"]
    assert series.counts.total == 2
    assert series.counts.not_applicable == 1


def test_series_empty():
    series = _series([], {}, scope_start=None, window_end=_TODAY, today=_TODAY)
    assert series.counts.total == 0
    assert series.counts.not_applicable == 0
    assert series.pct == 0
    assert series.items == []


def test_series_still_running_period_is_not_due_yet():
    p1, p2 = uuid4(), uuid4()
    periods = [
        _period(p1, date(2026, 9, 7), date(2026, 9, 13)),  # already ended -> pending
        _period(p2, date(2026, 9, 14), date(2026, 9, 20)),  # still running -> n/a, not pending
    ]

    series = _series(periods, {}, scope_start=None, window_end=date(2026, 12, 31), today=date(2026, 9, 15))

    assert [i.status for i in series.items] == ["pending", "n/a"]
    assert series.counts.pending == 1
    assert series.counts.not_applicable == 1
    assert series.counts.total == 1


def test_series_early_submission_during_still_running_period_counts():
    p1 = uuid4()
    periods = [_period(p1, date(2026, 9, 14), date(2026, 9, 20))]  # still running
    reports = {p1: _report(p1, ReportStatus.SUBMITTED, datetime(2026, 9, 15, tzinfo=timezone.utc))}

    series = _series(periods, reports, scope_start=None, window_end=date(2026, 12, 31), today=date(2026, 9, 15))

    assert series.items[0].status == "on-time"
    assert series.counts.pending == 0
    assert series.counts.not_applicable == 0


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


# --- tool_effective_date wiring (DB-backed) --------------------------------
# An isolated, throwaway sqlite DB per test — never the app's configured
# settings.database_url, which may point at a real shared Postgres server
# (same pattern as tests/test_master_data_import.py's session_factory).


@pytest.fixture
async def session_factory(tmp_path):
    db_path = tmp_path / "reporting_activity_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


def _now():
    return datetime.now(timezone.utc)


async def _make_project(session, **overrides):
    project = Project(
        id=uuid4(),
        project_code=f"P-{uuid4().hex[:8]}",
        project_name="Test Project",
        project_status="Draft",
        created_at=_now(),
        updated_at=_now(),
        **overrides,
    )
    session.add(project)
    await session.commit()
    return project


async def _make_period(session, period_type, start, end, code=None):
    period = ReportingPeriod(
        id=uuid4(),
        period_type=period_type,
        code=code or f"{period_type}-{uuid4().hex[:8]}",
        label=f"{period_type} {start}",
        start_date=start,
        end_date=end,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )
    session.add(period)
    await session.commit()
    return period


@pytest.mark.asyncio
async def test_build_reporting_activity_prefers_tool_effective_date_over_actual_start(session_factory):
    async with session_factory() as session:
        project = await _make_project(
            session, actual_start_date=date(2026, 1, 1), tool_effective_date=date(2026, 8, 1)
        )
        await _make_period(session, "Weekly", date(2026, 7, 6), date(2026, 7, 12))  # before effective date -> n/a
        await _make_period(session, "Weekly", date(2026, 8, 3), date(2026, 8, 9))  # on/after -> pending

        result = await build_reporting_activity(session, project.id, 2026)

        statuses = {item.start_date: item.status for item in result.weekly.items}
        assert statuses[date(2026, 7, 6)] == "n/a"
        assert statuses[date(2026, 8, 3)] == "pending"


@pytest.mark.asyncio
async def test_build_reporting_activity_falls_back_to_actual_start_when_tool_effective_date_null(session_factory):
    async with session_factory() as session:
        project = await _make_project(session, actual_start_date=date(2026, 8, 1), tool_effective_date=None)
        await _make_period(session, "Weekly", date(2026, 7, 6), date(2026, 7, 12))  # before actual start -> n/a
        await _make_period(session, "Weekly", date(2026, 8, 3), date(2026, 8, 9))  # on/after -> pending

        result = await build_reporting_activity(session, project.id, 2026)

        statuses = {item.start_date: item.status for item in result.weekly.items}
        assert statuses[date(2026, 7, 6)] == "n/a"
        assert statuses[date(2026, 8, 3)] == "pending"


@pytest.mark.asyncio
async def test_build_weekly_reporting_activity_respects_account_tool_effective_date(session_factory):
    async with session_factory() as session:
        account = Account(
            id=uuid4(), name="Acme", is_active=True, tool_effective_date=date(2026, 8, 1),
            created_at=_now(), updated_at=_now(),
        )
        session.add(account)
        await session.commit()
        await _make_period(session, "Weekly", date(2026, 7, 6), date(2026, 7, 12))  # before -> n/a
        await _make_period(session, "Weekly", date(2026, 8, 3), date(2026, 8, 9))  # on/after -> pending

        result = await build_weekly_reporting_activity(session, "account", account.id, 2026)

        statuses = {item.start_date: item.status for item in result.weekly.items}
        assert statuses[date(2026, 7, 6)] == "n/a"
        assert statuses[date(2026, 8, 3)] == "pending"


@pytest.mark.asyncio
async def test_build_weekly_reporting_activity_no_restriction_when_geo_effective_date_null(session_factory):
    async with session_factory() as session:
        geo = Geo(
            id=uuid4(), code="APAC", name="Asia Pacific", is_active=True, tool_effective_date=None,
            created_at=_now(), updated_at=_now(),
        )
        session.add(geo)
        await session.commit()
        await _make_period(session, "Weekly", date(2020, 1, 6), date(2020, 1, 12))

        result = await build_weekly_reporting_activity(session, "geo", geo.id, 2020)

        # No effective date set -> current/unrestricted behavior: an old period is still "pending", not "n/a".
        assert result.weekly.items[0].status == "pending"
