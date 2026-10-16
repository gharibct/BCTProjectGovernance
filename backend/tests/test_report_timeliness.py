from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.models.regional_status import GeoStatusReport
from app.models.submitted_at import _sync_submitted_at
from app.services.report_timeliness import is_late, submission_deadline


def _period(end, due):
    return SimpleNamespace(end_date=end, due_date=due)


def _report(filed, updated=None):
    return SimpleNamespace(submitted_at=filed, updated_at=updated or filed)


def test_late_is_measured_against_due_date_not_end_date():
    period = _period(date(2026, 10, 9), date(2026, 10, 13))  # Fri end, Tue due
    # Filed the Monday after the period end: past the end date, before the due date.
    assert not is_late(_report(datetime(2026, 10, 12, 10, tzinfo=timezone.utc)), period)
    assert not is_late(_report(datetime(2026, 10, 13, 23, tzinfo=timezone.utc)), period)
    assert is_late(_report(datetime(2026, 10, 14, 1, tzinfo=timezone.utc)), period)


def test_no_due_date_falls_back_to_end_date():
    period = _period(date(2026, 10, 9), None)
    assert submission_deadline(period) == date(2026, 10, 9)
    assert is_late(_report(datetime(2026, 10, 10, tzinfo=timezone.utc)), period)


def test_submitted_at_wins_over_later_edits():
    period = _period(date(2026, 10, 9), date(2026, 10, 13))
    report = _report(datetime(2026, 10, 12, tzinfo=timezone.utc), updated=datetime(2026, 10, 20, tzinfo=timezone.utc))
    assert not is_late(report, period)


def test_old_reports_without_submitted_at_use_updated_at():
    period = _period(date(2026, 10, 9), date(2026, 10, 13))
    assert is_late(SimpleNamespace(submitted_at=None, updated_at=datetime(2026, 10, 20, tzinfo=timezone.utc)), period)


def test_submitted_at_is_set_on_filing_and_cleared_on_recall():
    report = GeoStatusReport()
    report.status = "Baselined"
    _sync_submitted_at(None, None, report)
    first = report.submitted_at
    assert first is not None
    _sync_submitted_at(None, None, report)  # unchanged while still filed
    assert report.submitted_at == first
    report.status = "Draft - Saved"  # recalled
    _sync_submitted_at(None, None, report)
    assert report.submitted_at is None
