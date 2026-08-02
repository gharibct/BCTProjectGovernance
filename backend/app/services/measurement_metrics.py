"""Derives the 'computed, read-only in the UI' Measurement Entry metrics (UX
§4.10) from the raw inputs on the same record, at write time (not on every
read), since these are historical snapshots that should stay stable even if a
formula changes later.

Some metrics the source doc lists (Cost Performance Index, Code Coverage %,
Incident SLA Compliance %, Service/User-Clarification MTTR) need data the
Excel spec never defines a raw input for (a cost baseline, a coverage tool
feed, an SLA target, a duration field) — those are left None here rather than
guessed at, with a comment at each spot explaining the gap.
"""

from decimal import Decimal, InvalidOperation
from statistics import fmean

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.measurement import MeasurementStaffing, MeasurementStaffingPriorityMetric


def _safe_div(numerator: Decimal | int | None, denominator: Decimal | int | None, *, pct: bool = False) -> Decimal | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    try:
        result = Decimal(numerator) / Decimal(denominator)
    except (InvalidOperation, ZeroDivisionError):
        return None
    return result * 100 if pct else result


def compute_development_metrics(data: dict) -> dict:
    return {
        "productivity": _safe_div(data.get("actual_size"), data.get("actual_effort_as_on_date")),
        "effort_variation_pct": _pct_variation(data.get("planned_effort_as_on_date"), data.get("actual_effort_as_on_date")),
        # Proxy SPI (actual% / planned% completion) — a true SPI needs earned-value
        # data in currency/hours that isn't modeled here.
        "schedule_performance_index": _safe_div(data.get("actual_pct_completion"), data.get("planned_pct_completion")),
        "cost_performance_index": None,  # no cost baseline modeled
        "code_coverage_pct": None,  # no coverage-tool feed modeled
        "test_execution_coverage_pct": _safe_div(
            data.get("executed_test_cases"), data.get("total_test_cases_designed"), pct=True
        ),
        "test_pass_rate_pct": _safe_div(data.get("passed_test_cases"), data.get("executed_test_cases"), pct=True),
    }


def compute_defect_leakage_pct(total_internal: int, total_external: int) -> Decimal | None:
    total = total_internal + total_external
    if total == 0:
        return None
    return _safe_div(total_external, total, pct=True)


def _pct_variation(planned: Decimal | int | None, actual: Decimal | int | None) -> Decimal | None:
    if planned is None or actual is None or planned == 0:
        return None
    return ((Decimal(actual) - Decimal(planned)) / Decimal(planned)) * 100


def compute_support_metrics(data: dict) -> dict:
    total_person_days = sum(
        d
        for d in (
            data.get("incidents_p1_person_days"),
            data.get("incidents_p2_person_days"),
            data.get("incidents_p3_person_days"),
        )
        if d is not None
    )
    total_incidents = sum(
        c
        for c in (data.get("incidents_p1_count"), data.get("incidents_p2_count"), data.get("incidents_p3_count"))
        if c is not None
    )
    return {
        # SLA compliance needs a target threshold per priority, not modeled here.
        "incident_sla_compliance_p1_pct": None,
        "incident_sla_compliance_p2_pct": None,
        "incident_sla_compliance_p3_pct": None,
        # 8-hour workday assumption converting person-days to hours.
        "incident_mttr_hours": _safe_div(Decimal(total_person_days) * 8, total_incidents)
        if total_incidents
        else None,
        # No duration field collected for service requests / user clarifications.
        "service_request_mttr_hours": None,
        "user_clarification_mttr_hours": None,
    }


def compute_staffing_metrics(data: dict) -> dict:
    return {
        # Approximation: source doc doesn't separately track "profiles reviewed"
        # vs "profiles submitted", so this uses requests as the denominator.
        "pct_profiles_qualifying": _safe_div(data.get("profiles_submitted_count"), data.get("requests_count"), pct=True),
        "pct_candidates_joining": _safe_div(
            data.get("associates_joined_count"), data.get("interview_selects_count"), pct=True
        ),
    }


async def compute_staffing_priority_trailing_averages(
    db: AsyncSession, project_id, priority: str, trailing_periods: int = 4
) -> dict:
    """Rolling average of the last N periods' response/lead time for one
    priority bucket, used for the 'Average Response Time by priority' /
    'Lead Time by priority' computed metrics.
    """
    stmt = (
        select(MeasurementStaffingPriorityMetric.response_time_hours, MeasurementStaffingPriorityMetric.lead_time_days)
        .join(MeasurementStaffing, MeasurementStaffing.id == MeasurementStaffingPriorityMetric.measurement_id)
        .where(MeasurementStaffing.project_id == project_id, MeasurementStaffingPriorityMetric.priority == priority)
        .order_by(MeasurementStaffing.as_of_date.desc())
        .limit(trailing_periods)
    )
    rows = (await db.execute(stmt)).all()
    response_times = [r[0] for r in rows if r[0] is not None]
    lead_times = [r[1] for r in rows if r[1] is not None]
    return {
        "avg_response_time_hours": Decimal(str(fmean(response_times))) if response_times else None,
        "avg_lead_time_days": Decimal(str(fmean(lead_times))) if lead_times else None,
    }


def compute_testing_metrics(data: dict) -> dict:
    return {
        "test_execution_coverage_pct": _safe_div(
            data.get("executed_test_cases"), data.get("total_test_cases_designed"), pct=True
        ),
        "test_pass_rate_pct": _safe_div(data.get("passed_test_cases"), data.get("executed_test_cases"), pct=True),
        "automation_coverage_pct": _safe_div(
            data.get("automated_test_cases"), data.get("total_test_cases_designed"), pct=True
        ),
        "test_design_productivity": _safe_div(data.get("total_test_cases_designed"), data.get("effort_test_case_design")),
        "test_execution_productivity": _safe_div(data.get("executed_test_cases"), data.get("effort_test_execution")),
    }


def compute_cloud_maintenance_metrics(data: dict) -> dict:
    total_scheduled = data.get("total_scheduled_time_hours")
    downtime = data.get("application_downtime_hours")
    application_availability_pct = None
    if total_scheduled not in (None, 0) and downtime is not None:
        application_availability_pct = _safe_div(Decimal(total_scheduled) - Decimal(downtime), total_scheduled, pct=True)
    return {
        "service_availability_pct": _safe_div(data.get("total_uptime_hours"), total_scheduled, pct=True),
        "application_availability_pct": application_availability_pct,
    }


def compute_cloud_migration_metrics(data: dict) -> dict:
    downtime_minutes = None
    start = data.get("migration_start_time")
    end = data.get("migration_end_time")
    if start is not None and end is not None and end >= start:
        downtime_minutes = Decimal((end - start).total_seconds() / 60)
    return {
        "applications_migrated_pct": _safe_div(
            data.get("applications_migrated_count"), data.get("planned_application_migration_count"), pct=True
        ),
        "migration_success_rate_pct": _safe_div(
            data.get("successful_migrations"), data.get("total_migration_attempts"), pct=True
        ),
        "migration_downtime_minutes": downtime_minutes,
    }
