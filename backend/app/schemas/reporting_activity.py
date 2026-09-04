from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

# Reporting hubs (Project / Account / Geo) — per-period submission timeline
# for the progress rings and the activity heatmaps. See
# services/reporting_activity.py for how each status is decided. "n/a" =
# nothing was owed (period before the scope's start, or after the reporting
# window closes): drawn as a plain box, left out of the ring totals.

PeriodActivityStatus = Literal["on-time", "late", "pending", "n/a"]


class PeriodActivityItem(BaseModel):
    period_id: UUID
    label: str
    start_date: date
    end_date: date
    status: PeriodActivityStatus
    has_report: bool  # any report row exists (drives the hub's Open/Start action)


class ActivityCounts(BaseModel):
    on_time: int
    late: int
    pending: int
    not_applicable: int  # periods before project start or in the future
    submitted: int  # on_time + late
    total: int  # in-window periods only: on_time + late + pending


class ReportingActivitySeries(BaseModel):
    items: list[PeriodActivityItem]  # chronological (oldest period first)
    counts: ActivityCounts
    pct: int  # submitted / total, rounded


class ReportingActivityResponse(BaseModel):
    """Project Reporting — both cadences."""

    year: int
    weekly: ReportingActivitySeries
    monthly: ReportingActivitySeries


class WeeklyReportingActivityResponse(BaseModel):
    """Account / Geo Status Reporting — a single Weekly cadence."""

    year: int
    weekly: ReportingActivitySeries
