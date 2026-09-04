"""Unit tests for app.services.governance_completeness — the module-completeness
math behind the DE Project Approval workspace. No Postgres: a stub db answers
the per-register COUNT(*) queries, the metric-target row lookups and
db.get(ProjectType, ...) from canned values. The rules mirror
app.services.approval_readiness (the PM's Send To Approval screen).
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.schemas.enums import GovernanceModuleKey
from app.schemas.metric_target import MetricTargetDevelopmentIn
from app.services.governance_completeness import compute_governance_completeness

pytestmark = pytest.mark.asyncio

_COUNT_TABLES = [
    "project_oracle_ids",
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


class StubDB:
    """Answers `SELECT count(*) FROM <table>` from canned numbers, the flat
    metric-target lookup from `metric_row`, and db.get(ProjectType, ...) from
    `project_type`."""

    def __init__(
        self,
        *,
        project_type=SimpleNamespace(code="DEVELOPMENT", name="Development"),
        metric_row="__dev_default__",
        **counts,
    ):
        self._counts = {t: counts.get(t, 1) for t in _COUNT_TABLES}
        self._project_type = project_type
        self._metric_row = _dev_target() if metric_row == "__dev_default__" else metric_row

    async def get(self, model, pk):
        return self._project_type

    async def execute(self, stmt):
        sql = str(stmt).lower()
        if "count(" in sql:
            for table in sorted(self._counts, key=len, reverse=True):
                if table in sql:
                    return _Result(scalar_one=self._counts[table])
            return _Result(scalar_one=0)
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
        project_status="Pending Approval",
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


async def test_all_mandatory_complete():
    result = await compute_governance_completeness(StubDB(), _project())
    assert result.completion_pct == 100
    assert result.gaps_count == 0
    assert result.modules_incomplete == 0
    assert result.modules_complete == 5


async def test_partial_mandatory_lowers_pct_and_counts_gaps():
    db = StubDB(project_oracle_ids=0, contractual_commitments=0)
    result = await compute_governance_completeness(db, _project())
    assert result.completion_pct == 94  # 30 / 32 mandatory fields
    assert result.gaps_count == 2
    incomplete = {m.key for m in result.modules if not m.complete and m.mandatory}
    assert incomplete == {
        GovernanceModuleKey.MAP_ORACLE_PROJECTS,
        GovernanceModuleKey.CONTRACTUAL_COMPLIANCE,
    }
    contractual = next(
        m for m in result.modules if m.key == GovernanceModuleKey.CONTRACTUAL_COMPLIANCE
    )
    assert (contractual.fields_complete, contractual.fields_total) == (1, 2)  # milestones only
    for module in result.modules:
        if not module.complete and module.mandatory:
            assert module.gaps


async def test_incomplete_profile_is_a_gap():
    result = await compute_governance_completeness(StubDB(), _project(project_manager_id=None))
    profile = next(m for m in result.modules if m.key == GovernanceModuleKey.PROJECT_PROFILE)
    assert profile.complete is False
    assert (profile.fields_complete, profile.fields_total) == (13, 14)
    assert result.completion_pct == 97  # 31 / 32 mandatory fields


async def test_planned_end_date_required_for_scope_schedule():
    result = await compute_governance_completeness(StubDB(), _project(planned_end_date=None))
    scope = next(m for m in result.modules if m.key == GovernanceModuleKey.SCOPE_SCHEDULE)
    assert scope.complete is False
    assert (scope.fields_complete, scope.fields_total) == (3, 4)
    assert scope.progress_pct == 75
    assert result.completion_pct == 97  # 31 / 32 mandatory fields
    assert result.gaps_count == 1


async def test_measurement_is_mandatory_and_wired():
    # A null metric target -> Measurement 10/11 -> still an incomplete gap.
    db = StubDB(metric_row=_dev_target(target_productivity=None))
    result = await compute_governance_completeness(db, _project())
    measurement = next(m for m in result.modules if m.key == GovernanceModuleKey.MEASUREMENT)
    assert measurement.mandatory is True
    assert measurement.complete is False
    assert measurement.gaps
    assert (measurement.fields_complete, measurement.fields_total) == (10, 11)
    assert result.completion_pct == 97  # 31 / 32 mandatory fields
    assert result.gaps_count == 1


async def test_raido_excluded_from_math():
    # RAIDO registers empty, but the 5 mandatory modules pass -> still 100%.
    db = StubDB(risk_log=0, issue_log=0, dependency_log=0, assumption_log=0, opportunity_log=0)
    result = await compute_governance_completeness(db, _project())
    assert result.completion_pct == 100
    assert result.gaps_count == 0
    raido = next(m for m in result.modules if m.key == GovernanceModuleKey.RAIDO)
    assert raido.complete is False and raido.mandatory is False
