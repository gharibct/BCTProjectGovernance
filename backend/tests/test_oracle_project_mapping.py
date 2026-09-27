"""Project Health -> Oracle Projects: Oracle projects with / without a governance project."""

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.oracle_man_month import IntegrationLoadRun, OracleProjectMaster
from app.models.projects import Project, ProjectOracleId
from app.models.reference_data import Geo, Region
from app.schemas.enums import RoleCode
from app.services.oracle_project_mapping import (
    OracleProjectScope,
    list_oracle_projects,
    oracle_project_summary,
)
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

pytestmark = pytest.mark.asyncio

NOW = datetime.now(UTC)
_TS = {"created_at": NOW, "updated_at": NOW}


@pytest.fixture
async def db(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'oracle_mapping.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


async def _seed(db):
    """Two geos; Oracle projects: P1 (US, mapped), P2 (US, unmapped), P3 (MEA,
    unmapped), P4 (no GEO, unmapped), P5 (MEA, mapped, account 'Beta')."""
    us_geo = Geo(id=uuid.uuid4(), code="US", name="United States", is_active=True, **_TS)
    mea_geo = Geo(id=uuid.uuid4(), code="MEA", name="Middle East", is_active=True, **_TS)
    db.add_all([us_geo, mea_geo])
    await db.flush()
    us = Region(id=uuid.uuid4(), geo_id=us_geo.id, code="US", name="US", is_active=True, **_TS)
    oman = Region(id=uuid.uuid4(), geo_id=mea_geo.id, code="OMAN", name="Oman", is_active=True, **_TS)
    run = IntegrationLoadRun(
        id=uuid.uuid4(), source_name="BCT_MAN_MONTH", source_file="f.xlsx", month="Aug-26",
        month_start=date(2026, 8, 1), status="SUCCESS", rows_read=0, rows_loaded=0, rows_skipped=0,
        employees_inserted=0, employees_updated=0, projects_inserted=0, projects_updated=0,
        project_allocations_inserted=0, project_allocations_updated=0, allocations_written=0,
        allocations_removed=0, started_at=NOW,
    )  # fmt: skip
    db.add_all([us, oman, run])
    await db.flush()

    def oracle(number, account, region):
        return OracleProjectMaster(
            id=uuid.uuid4(), project_number=number, project_name=f"Project {number}", account_name=account,
            project_geo="BCT X", region_id=region.id if region else None, geo_id=region.geo_id if region else None,
            first_seen_month=date(2026, 8, 1), last_seen_month=date(2026, 8, 1), last_load_run_id=run.id, **_TS,
        )  # fmt: skip

    db.add_all(
        [
            oracle("P1", "Acme", us),
            oracle("P2", "Acme", us),
            oracle("P3", "Beta", oman),
            oracle("P4", " ACME ", None),
            oracle("P5", "Beta", oman),
        ]
    )
    project = Project(id=uuid.uuid4(), project_code="PRJ-1", project_name="Gov 1", project_status="Draft", **_TS)
    db.add(project)
    await db.flush()
    db.add_all(
        [
            ProjectOracleId(id=uuid.uuid4(), project_id=project.id, oracle_project_id="P1", created_at=NOW),
            ProjectOracleId(id=uuid.uuid4(), project_id=project.id, oracle_project_id="P5", created_at=NOW),
        ]
    )
    await db.commit()
    return us_geo, mea_geo, us, oman


async def _numbers(db, scope, **kwargs):
    items, total = await list_oracle_projects(db, scope, **kwargs)
    assert total == len(items)
    return [i.project_number for i in items]


async def test_org_wide_scope_splits_mapped_and_unmapped(db):
    await _seed(db)
    summary = await oracle_project_summary(db, OracleProjectScope())
    assert (summary.mapped_count, summary.unmapped_count, summary.unmapped_no_geo_count) == (2, 3, 1)
    assert await _numbers(db, OracleProjectScope()) == ["P2", "P3", "P4"]  # unmapped is the default
    assert await _numbers(db, OracleProjectScope(), status="mapped") == ["P1", "P5"]
    assert await _numbers(db, OracleProjectScope(), status="all") == ["P1", "P2", "P3", "P4", "P5"]


async def test_mapped_rows_carry_the_governance_project_code(db):
    await _seed(db)
    items, _ = await list_oracle_projects(db, OracleProjectScope(), status="all")
    by_number = {i.project_number: i for i in items}
    assert (by_number["P1"].mapped, by_number["P1"].governance_project_code) == (True, "PRJ-1")
    assert (by_number["P2"].mapped, by_number["P2"].governance_project_code) == (False, None)
    assert (by_number["P2"].geo_name, by_number["P2"].region_name) == ("United States", "US")
    assert by_number["P4"].geo_name is None


async def test_geo_head_sees_unmapped_in_their_geo_plus_those_with_no_geo(db):
    us_geo, mea_geo, *_ = await _seed(db)
    us_head = OracleProjectScope(owned_geo_ids=[us_geo.id])
    assert await _numbers(db, us_head) == ["P2", "P4"]  # P3 is another geo's; P1 is mapped
    summary = await oracle_project_summary(db, us_head)
    assert (summary.mapped_count, summary.unmapped_count) == (1, 2)  # P1 | P2 + P4

    mea_head = OracleProjectScope(owned_geo_ids=[mea_geo.id])
    assert await _numbers(db, mea_head) == ["P3", "P4"]

    assert await _numbers(db, OracleProjectScope(owned_geo_ids=[])) == ["P4"]  # owns nothing: only geo-less


async def test_delivery_manager_sees_unmapped_for_their_accounts_only(db):
    await _seed(db)
    acme = OracleProjectScope(owned_account_names=["acme"])
    assert await _numbers(db, acme) == ["P2", "P4"]  # account matched case/space-insensitively
    assert await _numbers(db, OracleProjectScope(owned_account_names=["beta"])) == ["P3"]
    assert await _numbers(db, OracleProjectScope(owned_account_names=[])) == []


async def test_filters_narrow_on_top_of_the_role_scope(db):
    us_geo, _, us, _ = await _seed(db)
    assert await _numbers(db, OracleProjectScope(geo_id=us_geo.id)) == ["P2"]
    assert await _numbers(db, OracleProjectScope(region_id=us.id), status="all") == ["P1", "P2"]
    assert await _numbers(db, OracleProjectScope(account_name="beta"), status="all") == ["P3", "P5"]
    # A Geo Head choosing one of their geos still sees the geo-less projects.
    assert await _numbers(db, OracleProjectScope(owned_geo_ids=[us_geo.id], geo_id=us_geo.id)) == ["P2", "P4"]


async def test_search_matches_number_name_and_account_and_paging_reports_the_total(db):
    await _seed(db)
    assert await _numbers(db, OracleProjectScope(), search="p3") == ["P3"]
    assert await _numbers(db, OracleProjectScope(), search="project p2") == ["P2"]
    assert await _numbers(db, OracleProjectScope(), search="acme") == ["P2", "P4"]
    items, total = await list_oracle_projects(db, OracleProjectScope(), status="all", skip=1, limit=2)
    assert (total, [i.project_number for i in items]) == (5, ["P2", "P3"])


# --- endpoints ---------------------------------------------------------------

_LIST = "/api/v1/dashboard/project-health/oracle-projects"


async def test_endpoints_require_auth(client):
    assert (await client.get(_LIST)).status_code == 401
    assert (await client.get(f"{_LIST}/summary")).status_code == 401


@pytest.mark.parametrize("role", [RoleCode.PROJECT_MANAGER, RoleCode.TEAM_MEMBER])
@pytest.mark.parametrize("suffix", ["", "/summary"])
async def test_project_and_team_members_are_refused(client, override_auth, role, suffix):
    response = await client.get(f"{_LIST}{suffix}", headers=override_auth(role))
    assert response.status_code == 403
