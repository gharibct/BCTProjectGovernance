"""PM / DM Compliance (services/pm_dm_compliance.py): per person, weekly reports
owed vs filed, on-time vs late, over the weeks of the selected month.
No Postgres — a statement-dispatching fake AsyncSession.
"""

from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.schemas.enums import ReportStatus
from app.services import pm_dm_compliance as svc
from app.services.dashboard import DashboardFilters

TODAY = date(2026, 11, 11)


def _week(end: date):
    return SimpleNamespace(
        id=uuid4(), period_type="Weekly", label=f"W {end}", start_date=end.replace(day=end.day - 4),
        end_date=end, due_date=end,
    )


WEEKS = [_week(date(2026, 10, d)) for d in (9, 16, 23)]
MONTH = WEEKS[-1]  # the selected (latest) week of the rolling window


def _report(entity_field: str, entity_id, week, *, late: bool = False):
    filed = datetime(2026, 10, week.end_date.day + (5 if late else 0), 9, tzinfo=timezone.utc)
    return SimpleNamespace(
        **{entity_field: entity_id}, period_id=week.id, status=ReportStatus.SUBMITTED,
        submitted_at=filed, updated_at=filed,
    )


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows

    def scalars(self):
        return self

    def __iter__(self):
        return iter(self._rows)


class _DB:
    def __init__(self, *, weeks, projects, proxies, accounts, user_accounts, project_reports, account_reports, names):
        self._by_table = {
            "reporting_periods": weeks,
            "projects": projects,
            "project_proxy_managers": proxies,
            "accounts": accounts,
            "user_accounts": user_accounts,
            "project_status_reports": project_reports,
            "account_status_reports": account_reports,
            "users": names,
        }

    async def execute(self, stmt):
        text = str(stmt)
        # Most specific table first — "FROM projects" must not match "project_status_reports".
        for table in (
            "project_proxy_managers", "project_status_reports", "account_status_reports",
            "reporting_periods", "user_accounts", "accounts", "projects", "users",
        ):
            if f"FROM {table}" in text:
                return _Result(self._by_table[table])
        raise AssertionError(f"unexpected statement: {text}")


@pytest.fixture(autouse=True)
def _no_restrictions(monkeypatch):
    async def none(db, project_ids, kind):
        return None

    monkeypatch.setattr(svc, "project_period_restriction", none)


async def test_pm_and_dm_rows_count_owed_filed_and_late():
    pm, proxy, dm = uuid4(), uuid4(), uuid4()
    p1, p2, acct = uuid4(), uuid4(), uuid4()
    start = date(2026, 1, 1)
    w9, w16, w23 = WEEKS
    db = _DB(
        weeks=WEEKS,
        projects=[(p1, pm, start), (p2, pm, start)],
        proxies=[(p1, proxy)],
        accounts=[(acct, start)],
        user_accounts=[(acct, dm), (acct, pm)],  # pm is also a DM of the account
        project_reports=[
            _report("project_id", p1, w9), _report("project_id", p1, w16, late=True),
            _report("project_id", p2, w9), _report("project_id", p2, w16), _report("project_id", p2, w23),
        ],
        account_reports=[_report("account_id", acct, w9)],
        names=[(pm, "Pat PM"), (proxy, "Prox Y"), (dm, "Dana DM")],
    )

    out = await svc.pm_dm_compliance(db, DashboardFilters(), MONTH, today=TODAY)

    assert [w.label for w in out.weeks] == [w.label for w in WEEKS]
    rows = {r.name: r for r in out.rows}
    assert set(rows) == {"Pat PM", "Prox Y", "Dana DM"}

    # PM: 2 projects + 1 account owed per week = 3/week. Week 9: 3/3; week 16: 2 project
    # reports (one late), account missing = 2/3; week 23: only p2 filed = 1/3.
    pat = rows["Pat PM"]
    assert [(c.expected, c.submitted) for c in pat.weeks] == [(3, 3), (3, 2), (3, 1)]
    assert (pat.expected, pat.submitted, pat.on_time) == (9, 6, 5)  # p1's week-16 report was late
    assert (pat.weeks_fully_submitted, pat.weeks_owed) == (1, 3)

    # Proxy PM owes p1 only.
    assert [(c.expected, c.submitted) for c in rows["Prox Y"].weeks] == [(1, 1), (1, 1), (1, 0)]

    # DM owes the account only.
    assert [(c.expected, c.submitted) for c in rows["Dana DM"].weeks] == [(1, 1), (1, 0), (1, 0)]

    assert out.summary.people == 3
    assert out.summary.fully_compliant_people == 0
    assert out.summary.expected == 9 + 3 + 3
    assert out.summary.submitted == 6 + 2 + 1


async def test_no_weeks_yet_gives_an_empty_report():
    db = _DB(
        weeks=[], projects=[], proxies=[], accounts=[], user_accounts=[],
        project_reports=[], account_reports=[], names=[],
    )
    out = await svc.pm_dm_compliance(db, DashboardFilters(), MONTH, today=TODAY)
    assert out.weeks == [] and out.rows == []
    assert out.summary.people == 0 and out.summary.submitted_pct == 0


async def test_no_period_gives_empty_report():
    out = await svc.pm_dm_compliance(None, DashboardFilters(), None, today=TODAY)
    assert out.period is None and out.rows == []
