"""Unit tests for app.services.approval_readiness — the module-completeness math
behind the Maintain Project "Send To Approval" screen. No Postgres: a stub db
answers COUNT(*), MAX(updated_at), the metric-target row lookups and
db.get(ProjectType, ...) from canned values.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.schemas.enums import StaffingPriority
from app.schemas.metric_target import MetricTargetDevelopmentIn
from app.services.approval_readiness import compute_approval_readiness

pytestmark = pytest.mark.asyncio

_COUNT_TABLES = [
    "contractual_commitments",
    "milestone_payments",
    "risk_log",
    "issue_log",
    "dependency_log",
    "assumption_log",
    "opportunity_log",
]


class _Result:
    def __init__(self, *, scalar_one=None, scalar_one_or_none=None, rows=None):
        self._scalar_one = scalar_one
        self._scalar_one_or_none = scalar_one_or_none
        self._rows = rows or []

    def scalar_one(self):
        return self._scalar_one

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return self

    def all(self):
        return self._rows


def _dev_target(**overrides):
    fields = {name: Decimal("1") for name in MetricTargetDevelopmentIn.model_fields}
    fields["target_size_unit"] = "FP"  # text column, not numeric
    fields.update(overrides)
    return SimpleNamespace(**fields)


def _staffing_priority(priority, response=Decimal("1"), lead=Decimal("1")):
    return SimpleNamespace(
        priority=priority,
        target_avg_response_time_hours=response,
        target_avg_lead_time_days=lead,
    )


class StubDB:
    def __init__(
        self,
        *,
        counts=None,
        project_type=SimpleNamespace(code="DEVELOPMENT", name="Development"),
        metric_row="__dev_default__",
        staffing_parent=None,
        staffing_priorities=None,
        updated_at=None,
    ):
        self._counts = {t: 1 for t in _COUNT_TABLES}
        self._counts.update(counts or {})
        self._project_type = project_type
        self._metric_row = _dev_target() if metric_row == "__dev_default__" else metric_row
        self._staffing_parent = staffing_parent
        self._staffing_priorities = staffing_priorities or []
        self._updated_at = updated_at or datetime.now(UTC)

    async def get(self, model, pk):
        return self._project_type

    async def execute(self, stmt):
        sql = str(stmt).lower()
        if "count(" in sql:
            for table in sorted(self._counts, key=len, reverse=True):
                if table in sql:
                    return _Result(scalar_one=self._counts[table])
            return _Result(scalar_one=0)
        if "max(" in sql:
            return _Result(scalar_one_or_none=self._updated_at)
        if "metric_target_staffing_priority" in sql:
            return _Result(rows=self._staffing_priorities)
        if "metric_target_staffing" in sql:
            return _Result(scalar_one_or_none=self._staffing_parent)
        if "metric_target_" in sql:
            return _Result(scalar_one_or_none=self._metric_row)
        return _Result(scalar_one=0)


def _project(**overrides):
    now = datetime.now(UTC)
    defaults = dict(
        id=uuid4(),
        project_code="PRJ-1",
        project_name="Test Project",
        contract_type="FPP",
        project_type_id=uuid4(),
        organization_id=uuid4(),
        project_owned="Fully Owned",
        geo_id=uuid4(),
        region_id=uuid4(),
        account_id=uuid4(),
        project_manager_id=uuid4(),
        delivery_manager_id=uuid4(),
        delivery_excellence_id=None,
        project_revenue=Decimal("100"),
        project_currency="USD",
        billing_type=None,
        engagement_type=None,
        critical_flag="Yes",
        product_flag="No",
        product_id=None,
        customer_overview="Customer context",
        project_scope_description="Scope",
        planned_start_date=date(2026, 1, 1),
        actual_start_date=None,
        planned_end_date=date(2026, 6, 1),
        actual_end_date=None,
        applicable_phase=None,
        project_status="Draft",
        lifecycle_status=None,
        planned_duration_days=None,
        actual_duration_days=None,
        delivery_declared_overall_health=None,
        de_assessed_project_health=None,
        overall_project_health=None,
        created_by=None,
        updated_by=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


async def test_all_mandatory_complete_can_submit():
    result = await compute_approval_readiness(StubDB(), _project())
    assert result.completion_pct == 100
    assert result.gaps_count == 0
    assert result.modules_incomplete == 0
    assert result.modules_complete == 5
    assert result.can_submit is True
    for m in result.modules:
        if m.mandatory:
            assert m.progress_pct == 100
            assert m.fields_complete == m.fields_total > 0


async def test_planned_end_date_required_for_scope_schedule():
    # planned_end_date missing -> scope_schedule is 3/4 and no longer complete.
    result = await compute_approval_readiness(StubDB(), _project(planned_end_date=None))
    scope = next(m for m in result.modules if m.key == "scope_schedule")
    assert scope.complete is False
    assert scope.fields_complete == 3
    assert scope.fields_total == 4
    assert scope.progress_pct == 75
    assert result.can_submit is False


async def test_partial_progress_is_field_weighted():
    # One Project Profile field blank -> that module is 13/14, and the overall
    # % reflects the single missing field out of 31 mandatory fields.
    result = await compute_approval_readiness(StubDB(), _project(project_currency=""))
    profile = next(m for m in result.modules if m.key == "project_profile")
    assert (profile.fields_complete, profile.fields_total) == (13, 14)
    assert result.completion_pct == 97  # 30 / 31 mandatory fields


async def test_missing_commitments_and_milestones_lowers_pct():
    db = StubDB(counts={"contractual_commitments": 0, "milestone_payments": 0})
    result = await compute_approval_readiness(db, _project())
    assert result.completion_pct == 94  # 29 / 31 mandatory fields
    assert result.gaps_count == 2
    incomplete = {m.key for m in result.modules if not m.complete and m.mandatory}
    assert incomplete == {"commitments", "milestones"}
    for m in result.modules:
        if not m.complete and m.mandatory:
            assert m.gaps


async def test_no_project_type_marks_measurement_incomplete():
    # project_type_id set (so the profile flag stays happy) but the ProjectType
    # row can't be resolved -> only Measurement is incomplete.
    db = StubDB(project_type=None)
    result = await compute_approval_readiness(db, _project())
    measurement = next(m for m in result.modules if m.key == "measurement")
    assert measurement.complete is False
    assert measurement.gaps == "No project type set"
    assert result.completion_pct == 95  # 20 / 21 mandatory fields


async def test_measurement_row_with_a_null_target_is_incomplete():
    db = StubDB(metric_row=_dev_target(target_productivity=None))
    result = await compute_approval_readiness(db, _project())
    measurement = next(m for m in result.modules if m.key == "measurement")
    assert measurement.complete is False
    assert result.can_submit is False


async def test_staffing_requires_a_row_per_priority():
    parent = SimpleNamespace(
        id=uuid4(),
        target_pct_profiles_qualifying=Decimal("1"),
        target_pct_candidates_joining=Decimal("1"),
    )
    only_two = [_staffing_priority(StaffingPriority.CRITICAL.value), _staffing_priority(StaffingPriority.HIGH.value)]
    db = StubDB(
        project_type=SimpleNamespace(code="PROFESSIONAL_STAFFING", name="Professional Staffing"),
        staffing_parent=parent,
        staffing_priorities=only_two,
    )
    result = await compute_approval_readiness(db, _project())
    measurement = next(m for m in result.modules if m.key == "measurement")
    assert measurement.complete is False

    all_four = [_staffing_priority(p.value) for p in StaffingPriority]
    db_ok = StubDB(
        project_type=SimpleNamespace(code="PROFESSIONAL_STAFFING", name="Professional Staffing"),
        staffing_parent=parent,
        staffing_priorities=all_four,
    )
    result_ok = await compute_approval_readiness(db_ok, _project())
    measurement_ok = next(m for m in result_ok.modules if m.key == "measurement")
    assert measurement_ok.complete is True


async def test_raido_empty_does_not_block_submission():
    db = StubDB(counts={"risk_log": 0, "issue_log": 0, "dependency_log": 0, "assumption_log": 0, "opportunity_log": 0})
    result = await compute_approval_readiness(db, _project())
    assert result.completion_pct == 100
    assert result.can_submit is True
    raido = next(m for m in result.modules if m.key == "raido")
    assert raido.complete is False and raido.mandatory is False


async def test_non_draft_project_cannot_submit_even_when_complete():
    for st in ("Pending Approval", "Approved"):
        result = await compute_approval_readiness(StubDB(), _project(project_status=st))
        assert result.modules_incomplete == 0
        assert result.can_submit is False


async def test_under_amendment_project_can_submit_when_complete():
    result = await compute_approval_readiness(StubDB(), _project(project_status="Under Amendment"))
    assert result.modules_incomplete == 0
    assert result.can_submit is True


async def test_incomplete_profile_is_a_gap():
    result = await compute_approval_readiness(StubDB(), _project(project_manager_id=None))
    profile = next(m for m in result.modules if m.key == "project_profile")
    assert profile.complete is False
    assert (profile.fields_complete, profile.fields_total) == (13, 14)
    assert result.completion_pct == 97  # 30 / 31 mandatory fields
