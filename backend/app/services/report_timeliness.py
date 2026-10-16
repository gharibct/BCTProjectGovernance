"""Late-submission rule shared by the reporting hubs and the dashboards.

A report is late when it was filed after the reporting period's due date (the
Weekly / Monthly `due_date` set in Admin -> Reporting Periods). A period with no
due date falls back to its end date. The filing time is the report's
`submitted_at`; reports from before that column existed use `updated_at`.
"""

from datetime import date, datetime
from typing import Protocol

from app.models.reference_data import ReportingPeriod


class _Filed(Protocol):
    submitted_at: datetime | None
    updated_at: datetime


def submission_deadline(period: ReportingPeriod) -> date:
    return period.due_date or period.end_date


def is_late(report: _Filed, period: ReportingPeriod) -> bool:
    filed_at = report.submitted_at or report.updated_at
    return filed_at.date() > submission_deadline(period)
