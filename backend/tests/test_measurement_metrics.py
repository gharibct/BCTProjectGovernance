"""Unit tests for app.services.measurement_metrics — the write-time formula
arithmetic behind the Measurement Entry "computed, read-only" metrics. Pure
functions, no DB. Guards the corrections made to match the requirements
workbook's Measurement sheet.
"""

from datetime import UTC, datetime
from decimal import Decimal

from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

from app.services.measurement_metrics import (
    compute_cloud_migration_metrics,
    compute_development_metrics,
    compute_staffing_metrics,
    compute_staffing_priority_metrics,
    compute_support_metrics,
    compute_testing_metrics,
)


# --- Development ---------------------------------------------------------------


def test_dev_effort_variation_uses_overall_estimated_effort_not_planned_as_of_date():
    # estimate 100, actual 120 -> +20%. planned_effort_as_on_date is a decoy
    # (the old, wrong denominator) set to a value that would give -40%.
    result = compute_development_metrics(
        {
            "overall_estimated_effort": Decimal("100"),
            "planned_effort_as_on_date": Decimal("200"),
            "actual_effort_as_on_date": Decimal("120"),
        }
    )
    assert result["effort_variation_pct"] == Decimal("20")


def test_dev_cpi_uses_effort_hours_cost_proxy_with_percent_scale():
    # EV = 50% * 200 = 100 effort-hours; AC = 80 effort-hours -> CPI 1.25.
    result = compute_development_metrics(
        {
            "actual_pct_completion": Decimal("50"),
            "overall_estimated_effort": Decimal("200"),
            "actual_effort_as_on_date": Decimal("80"),
        }
    )
    assert result["cost_performance_index"] == Decimal("1.25")


def test_dev_cpi_is_none_without_the_inputs():
    assert compute_development_metrics({})["cost_performance_index"] is None


def test_dev_code_coverage_none_until_inputs_present_then_computes():
    assert compute_development_metrics({})["code_coverage_pct"] is None
    result = compute_development_metrics(
        {"covered_code_elements": 850, "total_applicable_code_elements": 1000}
    )
    assert result["code_coverage_pct"] == Decimal("85")


# --- Support -----------------------------------------------------------------


def test_support_incident_mttr_is_per_priority_not_blended():
    result = compute_support_metrics(
        {
            "incidents_p1_count": 2,
            "incidents_p1_person_days": Decimal("1"),  # 1*8/2 = 4h
            "incidents_p2_count": 4,
            "incidents_p2_person_days": Decimal("4"),  # 4*8/4 = 8h
            "incidents_p3_count": 1,
            "incidents_p3_person_days": Decimal("3"),  # 3*8/1 = 24h
        }
    )
    assert result["incident_mttr_p1_hours"] == Decimal("4")
    assert result["incident_mttr_p2_hours"] == Decimal("8")
    assert result["incident_mttr_p3_hours"] == Decimal("24")
    # No blended value is emitted any more.
    assert "incident_mttr_hours" not in result


def test_support_sla_compliance_computes_per_priority():
    result = compute_support_metrics(
        {
            "incidents_p1_count": 100,
            "incidents_p1_resolved_within_sla_count": 99,
            "incidents_p2_count": 50,
            "incidents_p2_resolved_within_sla_count": 49,
        }
    )
    assert result["incident_sla_compliance_p1_pct"] == Decimal("99")
    assert result["incident_sla_compliance_p2_pct"] == Decimal("98")
    assert result["incident_sla_compliance_p3_pct"] is None


def test_support_sr_and_uc_mttr_from_total_person_days():
    result = compute_support_metrics(
        {
            "service_requests_count": 10,
            "service_requests_total_person_days": Decimal("5"),  # 5*8/10 = 4h
            "user_clarifications_count": 4,
            "user_clarifications_total_person_days": Decimal("2"),  # 2*8/4 = 4h
        }
    )
    assert result["service_request_mttr_hours"] == Decimal("4")
    assert result["user_clarification_mttr_hours"] == Decimal("4")


# --- Staffing --------------------------------------------------------------


def test_staffing_pct_profiles_qualifying_is_interviews_over_submitted():
    result = compute_staffing_metrics(
        {
            "client_interviews_count": 30,
            "profiles_submitted_count": 50,
            "requests_count": 999,  # decoy — the old, wrong denominator
        }
    )
    assert result["pct_profiles_qualifying"] == Decimal("60")


def test_staffing_priority_metrics_are_period_total_over_count():
    result = compute_staffing_priority_metrics(
        {
            "response_time_hours_total": Decimal("18"),
            "requests_responded_count": 4,
            "lead_time_days_total": Decimal("60"),
            "associates_onboarded_count": 5,
        }
    )
    assert result["avg_response_time_hours"] == Decimal("4.5")
    assert result["avg_lead_time_days"] == Decimal("12")


def test_staffing_priority_metrics_none_when_count_missing_or_zero():
    assert compute_staffing_priority_metrics({"response_time_hours_total": Decimal("18")})[
        "avg_response_time_hours"
    ] is None
    assert compute_staffing_priority_metrics(
        {"response_time_hours_total": Decimal("18"), "requests_responded_count": 0}
    )["avg_response_time_hours"] is None


# --- Testing --------------------------------------------------------------


def test_testing_automation_coverage_uses_eligible_denominator():
    # 40 automated of 50 eligible = 80%, even though 100 were designed.
    result = compute_testing_metrics(
        {
            "automated_test_cases": 40,
            "automation_eligible_test_cases": 50,
            "total_test_cases_designed": 100,
        }
    )
    assert result["automation_coverage_pct"] == Decimal("80")


# --- Cloud Migration ------------------------------------------------------


def test_cloud_migration_downtime_is_hours_not_minutes():
    start = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
    end = datetime(2026, 1, 1, 2, 30, tzinfo=UTC)  # 2.5 hours
    result = compute_cloud_migration_metrics(
        {"migration_start_time": start, "migration_end_time": end}
    )
    assert result["migration_downtime_hours"] == Decimal("2.5")
    assert "migration_downtime_minutes" not in result


# --- Metric reference endpoint ------------------------------------------------


async def test_metric_reference_endpoint_shape(client, override_auth):
    from app.schemas.enums import RoleCode

    headers = override_auth(RoleCode.TEAM_MEMBER)
    response = await client.get("/api/v1/metric-reference", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "DEVELOPMENT",
        "SUPPORT",
        "PROFESSIONAL_STAFFING",
        "TESTING",
        "CLOUD_MAINTENANCE",
        "CLOUD_MIGRATION",
        "CONSULTING",
    }
    assert body["CONSULTING"]["has_excel_reference"] is False
    assert body["CONSULTING"]["metrics"] == []
    dev = {m["key"]: m for m in body["DEVELOPMENT"]["metrics"]}
    assert dev["effort_variation_pct"]["operational_definition"]
    assert dev["effort_variation_pct"]["benchmark_value"]
    assert dev["cost_performance_index"]["unit"] == "No Unit"
    # Units containing "#" must be YAML-quoted, or they get truncated at the
    # "#" as a comment.
    sup = {m["key"]: m for m in body["SUPPORT"]["metrics"]}
    assert sup["incident_mttr_hours"]["unit"] == "Person-Hours / # of Incidents"
    assert len(body["TESTING"]["metrics"]) == 5
    assert len(body["DEVELOPMENT"]["metrics"]) == 8


async def test_metric_reference_requires_auth(client):
    response = await client.get("/api/v1/metric-reference")
    assert response.status_code == 401
