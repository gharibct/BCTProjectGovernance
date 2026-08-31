"""Unit tests for app.services.governance_completeness — the module-completeness
math behind the DE Project Approval workspace. No Postgres: a stub db answers
the per-register COUNT(*) queries from canned numbers.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.schemas.enums import GovernanceModuleKey
from app.services.governance_completeness import compute_governance_completeness

pytestmark = pytest.mark.asyncio

_TABLES = [
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
    def __init__(self, value):
        self._value = value

    def scalar_one(self):
        return self._value


class StubDB:
    """Answers each `SELECT count(*) FROM <table> WHERE project_id = ...` with a
    canned count based on the table name in the compiled SQL."""

    def __init__(self, **counts):
        self._counts = {t: counts.get(t, 1) for t in _TABLES}

    async def execute(self, stmt):
        sql = str(stmt).lower()
        for table in sorted(self._counts, key=len, reverse=True):
            if table in sql:
                return _Result(self._counts[table])
        return _Result(0)


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
    assert result.modules_complete == 4


async def test_partial_mandatory_lowers_pct_and_counts_gaps():
    db = StubDB(project_oracle_ids=0, contractual_commitments=0)
    result = await compute_governance_completeness(db, _project())
    assert result.completion_pct == 50
    assert result.gaps_count == 2
    incomplete = {m.key for m in result.modules if not m.complete and m.mandatory}
    assert incomplete == {
        GovernanceModuleKey.MAP_ORACLE_PROJECTS,
        GovernanceModuleKey.CONTRACTUAL_COMPLIANCE,
    }
    for module in result.modules:
        if not module.complete and module.mandatory:
            assert module.gaps


async def test_incomplete_profile_is_a_gap():
    result = await compute_governance_completeness(StubDB(), _project(project_manager_id=None))
    profile = next(m for m in result.modules if m.key == GovernanceModuleKey.PROJECT_PROFILE)
    assert profile.complete is False
    assert result.completion_pct == 75


async def test_raido_and_measurement_excluded_from_math():
    # RAIDO registers empty and Measurement always incomplete, but the 4
    # mandatory modules pass -> still 100%.
    db = StubDB(risk_log=0, issue_log=0, dependency_log=0, assumption_log=0, opportunity_log=0)
    result = await compute_governance_completeness(db, _project())
    assert result.completion_pct == 100
    assert result.gaps_count == 0
    raido = next(m for m in result.modules if m.key == GovernanceModuleKey.RAIDO)
    measurement = next(m for m in result.modules if m.key == GovernanceModuleKey.MEASUREMENT)
    assert raido.complete is False and raido.mandatory is False
    assert measurement.complete is False and measurement.mandatory is False
