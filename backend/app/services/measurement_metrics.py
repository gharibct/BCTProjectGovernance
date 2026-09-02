"""Derives the 'computed, read-only in the UI' Measurement Entry metrics (UX
§4.10) from the raw inputs on the same record, at write time (not on every
read), since these are historical snapshots that should stay stable even if a
formula changes later.

Formulas are kept in step with the requirements workbook's "Measurement" sheet
(see app/data/metric_reference.yaml, which the popup reads). Where a formula
was corrected to match that sheet, or a metric that used to be left None is now
computed, there's a `FIX:` / `NEW:` comment at the compute site.
"""

from decimal import Decimal, InvalidOperation


def _safe_div(numerator: Decimal | int | None, denominator: Decimal | int | None, *, pct: bool = False) -> Decimal | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    try:
        result = Decimal(numerator) / Decimal(denominator)
    except (InvalidOperation, ZeroDivisionError):
        return None
    return result * 100 if pct else result


def _mul(a: Decimal | int | None, b: Decimal | int | None, *, scale: Decimal | int = 1) -> Decimal | None:
    """None-safe multiply: None if either operand is None, else a * b * scale."""
    if a is None or b is None:
        return None
    try:
        return Decimal(a) * Decimal(b) * Decimal(scale)
    except (InvalidOperation, ValueError):
        return None


def _pct_variation(planned: Decimal | int | None, actual: Decimal | int | None) -> Decimal | None:
    if planned is None or actual is None or planned == 0:
        return None
    return ((Decimal(actual) - Decimal(planned)) / Decimal(planned)) * 100


def compute_development_metrics(data: dict) -> dict:
    return {
        "productivity": _safe_div(data.get("actual_size"), data.get("actual_effort_as_on_date")),
        # FIX: baseline is the Overall Estimated Effort, not Planned Effort As Of Date.
        "effort_variation_pct": _pct_variation(
            data.get("overall_estimated_effort"), data.get("actual_effort_as_on_date")
        ),
        # SPI = EV / PV. With EV = actual%complete x BAC and PV = planned%complete x BAC
        # (BAC = overall estimated effort), the budget cancels and this reduces to the
        # completion-ratio below.
        "schedule_performance_index": _safe_div(data.get("actual_pct_completion"), data.get("planned_pct_completion")),
        # FIX: CPI via the Excel's own effort-hours cost proxy ("approved effort-hours
        # may be used consistently as the cost proxy"). EV(effort-hrs) =
        # actual%complete/100 x overall_estimated_effort; AC(effort-hrs) =
        # actual_effort_as_on_date. The /100 matters here (unlike SPI) because there is
        # no matching percentage on the denominator to cancel it against.
        "cost_performance_index": _safe_div(
            _mul(data.get("actual_pct_completion"), data.get("overall_estimated_effort"), scale=Decimal("0.01")),
            data.get("actual_effort_as_on_date"),
        ),
        # NEW: optional (Excel Mandatory = N) — needs the two code-element inputs.
        "code_coverage_pct": _safe_div(
            data.get("covered_code_elements"), data.get("total_applicable_code_elements"), pct=True
        ),
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


def compute_support_metrics(data: dict) -> dict:
    def mttr(count_key: str, days_key: str) -> Decimal | None:
        # 8-hour workday assumption converting person-days to hours.
        return _safe_div(_mul(data.get(days_key), 8), data.get(count_key))

    return {
        # FIX: computed per priority — "resolved within SLA" count over the
        # priority's total incident count (all logged incidents are treated as
        # SLA-applicable).
        "incident_sla_compliance_p1_pct": _safe_div(
            data.get("incidents_p1_resolved_within_sla_count"), data.get("incidents_p1_count"), pct=True
        ),
        "incident_sla_compliance_p2_pct": _safe_div(
            data.get("incidents_p2_resolved_within_sla_count"), data.get("incidents_p2_count"), pct=True
        ),
        "incident_sla_compliance_p3_pct": _safe_div(
            data.get("incidents_p3_resolved_within_sla_count"), data.get("incidents_p3_count"), pct=True
        ),
        # FIX: per priority (was a single blended value across P1-P3).
        "incident_mttr_p1_hours": mttr("incidents_p1_count", "incidents_p1_person_days"),
        "incident_mttr_p2_hours": mttr("incidents_p2_count", "incidents_p2_person_days"),
        "incident_mttr_p3_hours": mttr("incidents_p3_count", "incidents_p3_person_days"),
        # NEW: needs the total-resolution-time inputs (only a count existed before).
        "service_request_mttr_hours": mttr("service_requests_count", "service_requests_total_person_days"),
        "user_clarification_mttr_hours": mttr(
            "user_clarifications_count", "user_clarifications_total_person_days"
        ),
    }


def compute_staffing_metrics(data: dict) -> dict:
    return {
        # FIX: was profiles_submitted_count / requests_count — Excel wants
        # profiles progressing to client interview / profiles submitted.
        "pct_profiles_qualifying": _safe_div(
            data.get("client_interviews_count"), data.get("profiles_submitted_count"), pct=True
        ),
        "pct_candidates_joining": _safe_div(
            data.get("associates_joined_count"), data.get("interview_selects_count"), pct=True
        ),
    }


def compute_staffing_priority_metrics(data: dict) -> dict:
    """FIX: Excel's per-period formula (sum of times / count), replacing the
    old rolling 4-period average. Pure function — no DB access, no prior-period
    lookup.
    """
    return {
        "avg_response_time_hours": _safe_div(
            data.get("response_time_hours_total"), data.get("requests_responded_count")
        ),
        "avg_lead_time_days": _safe_div(
            data.get("lead_time_days_total"), data.get("associates_onboarded_count")
        ),
    }


def compute_testing_metrics(data: dict) -> dict:
    return {
        "test_execution_coverage_pct": _safe_div(
            data.get("executed_test_cases"), data.get("total_test_cases_designed"), pct=True
        ),
        "test_pass_rate_pct": _safe_div(data.get("passed_test_cases"), data.get("executed_test_cases"), pct=True),
        # FIX: denominator is Automation-Eligible Test Cases, not Total Designed.
        "automation_coverage_pct": _safe_div(
            data.get("automated_test_cases"), data.get("automation_eligible_test_cases"), pct=True
        ),
        "test_design_productivity": _safe_div(data.get("total_test_cases_designed"), data.get("effort_test_case_design")),
        "test_execution_productivity": _safe_div(data.get("executed_test_cases"), data.get("effort_test_execution")),
    }


def compute_consulting_metrics(data: dict) -> dict:
    return {
        "effort_variation_pct": _pct_variation(
            data.get("planned_effort_as_on_date"), data.get("actual_effort_as_on_date")
        ),
        # Proxy SPI, same approach as Development — a true SPI needs
        # earned-value data in currency/hours that isn't modeled here.
        "schedule_performance_index": _safe_div(data.get("actual_pct_completion"), data.get("planned_pct_completion")),
        "cost_performance_index": _safe_div(data.get("planned_cost"), data.get("actual_cost")),
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
    downtime_hours = None
    start = data.get("migration_start_time")
    end = data.get("migration_end_time")
    if start is not None and end is not None and end >= start:
        # FIX: Excel unit is Person-Hours (was computed/stored in minutes).
        downtime_hours = Decimal((end - start).total_seconds() / 3600)
    return {
        "applications_migrated_pct": _safe_div(
            data.get("applications_migrated_count"), data.get("planned_application_migration_count"), pct=True
        ),
        "migration_success_rate_pct": _safe_div(
            data.get("successful_migrations"), data.get("total_migration_attempts"), pct=True
        ),
        "migration_downtime_hours": downtime_hours,
    }
