"""Pure reduction math for the DE Findings KPI tiles + "Attention Required"
chips — no DB, no app, just app.services.de_findings.compute_kpis over a hand-
built list of finding-shaped objects."""

from datetime import UTC, date, datetime, time, timedelta
from types import SimpleNamespace
from uuid import uuid4

from app.services.dashboard import current_month_window
from app.services.de_findings import compute_kpis


def _finding(**overrides):
    now = datetime.now(UTC)
    defaults = {
        "project_id": uuid4(),
        "status": "Open",
        "due_date": None,
        "finding_date": None,
        "updated_at": now,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_compute_kpis_counts_every_bucket():
    window = current_month_window()
    today = date.today()
    p1, p2 = uuid4(), uuid4()
    now = datetime.now(UTC)
    before_window = datetime.combine(window.start_date - timedelta(days=1), time())

    findings = [
        # 1: open, overdue by 5d (not >30), p1
        _finding(project_id=p1, status="Open", due_date=today - timedelta(days=5)),
        # 2: open, overdue by 40d (>30), p1
        _finding(project_id=p1, status="Open", due_date=today - timedelta(days=40)),
        # 3: in progress, not overdue (future due), p1
        _finding(project_id=p1, status="In Progress", due_date=today + timedelta(days=5)),
        # 4: awaiting closure, no due date, p1
        _finding(project_id=p1, status="Awaiting Closure", due_date=None),
        # 5: closed this month, past due but closed → not overdue
        _finding(project_id=p1, status="Closed", due_date=today - timedelta(days=3), updated_at=now),
        # 6: cancelled, past due → not overdue, not open
        _finding(project_id=p1, status="Cancelled", due_date=today - timedelta(days=10)),
        # 7: open, no due date, p2
        _finding(project_id=p2, status="Open", due_date=None),
        # 8: closed but outside the current month → not closed_this_period
        _finding(project_id=p2, status="Closed", updated_at=before_window),
    ]

    kpis = compute_kpis(findings, window)

    assert kpis.open_findings == 5  # 1 2 3 4 7
    assert kpis.overdue == 2  # 1 2
    assert kpis.awaiting_closure == 1  # 4
    assert kpis.awaiting_closure_count == 1
    assert kpis.closed_this_period == 1  # 5 only
    assert kpis.overdue_30d_count == 1  # 2 only
    assert kpis.projects_over_5_open_count == 0  # p1 has 4 open, p2 has 1
    assert kpis.period_label == window.label


def test_compute_kpis_flags_projects_over_five_open():
    window = current_month_window()
    busy = uuid4()
    findings = [_finding(project_id=busy, status="Open") for _ in range(6)]
    findings += [_finding(project_id=uuid4(), status="Open") for _ in range(3)]

    kpis = compute_kpis(findings, window)

    assert kpis.open_findings == 9
    assert kpis.projects_over_5_open_count == 1


def test_compute_kpis_empty():
    kpis = compute_kpis([], current_month_window())
    assert kpis.open_findings == 0
    assert kpis.overdue == 0
    assert kpis.projects_over_5_open_count == 0
