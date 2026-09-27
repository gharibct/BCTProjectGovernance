"""Project profile pre-fill from oracle_project_master (Create Project screen)."""

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.oracle_man_month import IntegrationLoadRun, OracleProjectMaster
from app.models.reference_data import Account, Geo, Organization, Region
from app.schemas.enums import RoleCode
from app.services.oracle_project_profile import (
    oracle_project_descriptions,
    region_token,
    resolve_oracle_project_profile,
)
from tests.test_authorization import override_auth  # noqa: F401  (pytest fixture)

NOW = datetime.now(UTC)


@pytest.mark.parametrize(
    ("project_geo", "token"),
    [
        ("BCT US", "US"),
        ("BCT  Singapore", "SINGAPORE"),
        ("BCTC UK", "UK"),  # "BCTC " is not read as "BCT" + "C UK"
        ("BRUNEI", "BRUNEI"),  # no prefix
        ("  bct oman ", "OMAN"),
        ("", None),
        (None, None),
    ],
)
def test_region_token_strips_the_bct_prefix(project_geo, token):
    assert region_token(project_geo) == token


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    tables = [Organization, Geo, Region, Account, IntegrationLoadRun, OracleProjectMaster]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[t.__table__ for t in tables]))
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


def _ts():
    return {"created_at": NOW, "updated_at": NOW}


async def _seed(db, *, project_geo="BCT US", account_name="Acme Corp", with_account=True):
    us_geo = Geo(id=uuid.uuid4(), code="US", name="United States", is_active=True, **_ts())
    mea_geo = Geo(id=uuid.uuid4(), code="MEA", name="Middle East & Africa", is_active=True, **_ts())
    db.add_all([us_geo, mea_geo])
    await db.flush()
    us = Region(id=uuid.uuid4(), geo_id=us_geo.id, code="US", name="United States", is_active=True, **_ts())
    oman = Region(id=uuid.uuid4(), geo_id=mea_geo.id, code="OMAN", name="Oman", is_active=True, **_ts())
    db.add_all(
        [
            Organization(id=uuid.uuid4(), code="BCTPL", name="BCT Private Limited", is_active=True, **_ts()),
            Organization(id=uuid.uuid4(), code="BCTC", name="BCT Consulting", is_active=True, **_ts()),
            us,
            oman,
        ]
    )
    account = None
    if with_account:
        account = Account(id=uuid.uuid4(), name="Acme Corp", geo_id=us_geo.id, region_id=us.id, is_active=True, **_ts())
        db.add(account)
    run = IntegrationLoadRun(
        id=uuid.uuid4(), source_name="X", source_file="f", month="Aug-26", month_start=date(2026, 8, 1),
        status="SUCCESS", rows_read=1, rows_loaded=1, rows_skipped=0, employees_inserted=0, employees_updated=0,
        projects_inserted=1, projects_updated=0, project_allocations_inserted=0, project_allocations_updated=0,
        allocations_written=0, allocations_removed=0, started_at=NOW,
    )  # fmt: skip
    db.add(run)
    await db.flush()
    db.add(
        OracleProjectMaster(
            id=uuid.uuid4(), project_number="52047", project_name="KPO Project", account_name=account_name,
            project_geo=project_geo, first_seen_month=date(2026, 8, 1), last_seen_month=date(2026, 8, 1),
            last_load_run_id=run.id, **_ts(),
        )
    )  # fmt: skip
    await db.flush()
    return us_geo, us, account


async def test_profile_resolves_org_region_geo_and_account(db):
    us_geo, us, account = await _seed(db)
    profile = await resolve_oracle_project_profile(db, " 52047 ")
    assert profile.found and profile.oracle_project_id == "52047"
    assert (profile.region_id, profile.geo_id, profile.account_id) == (us.id, us_geo.id, account.id)
    assert profile.organization_id is not None
    assert profile.notes == []
    assert profile.oracle_project_name == "KPO Project"


async def test_account_is_matched_case_insensitively(db):
    _, _, account = await _seed(db, account_name="  ACME corp ")
    assert (await resolve_oracle_project_profile(db, "52047")).account_id == account.id


async def test_unknown_oracle_id_is_not_found(db):
    await _seed(db)
    profile = await resolve_oracle_project_profile(db, "nope")
    assert profile.found is False
    assert profile.region_id is profile.geo_id is profile.account_id is profile.organization_id is None


async def test_unmatched_region_and_missing_account_are_left_for_manual_selection(db):
    await _seed(db, project_geo="BCT TAIWAN", with_account=False)
    profile = await resolve_oracle_project_profile(db, "52047")
    assert profile.found
    assert profile.organization_id is not None  # BCTPL regardless
    assert profile.region_id is None and profile.geo_id is None and profile.account_id is None
    assert len(profile.notes) == 2
    assert "TAIWAN" in profile.notes[0] and "Acme Corp" in profile.notes[1]


async def test_region_matches_on_name_too(db):
    await _seed(db, project_geo="BCT Oman")
    profile = await resolve_oracle_project_profile(db, "52047")
    assert profile.region_id is not None


async def test_descriptions_map_oracle_numbers_to_project_names(db):
    await _seed(db)
    assert await oracle_project_descriptions(db, ["52047", "unknown"]) == {"52047": "KPO Project"}
    assert await oracle_project_descriptions(db, []) == {}


def test_oracle_id_read_carries_the_description():
    from types import SimpleNamespace

    from app.api.v1.endpoints.projects import _oracle_id_read

    item = SimpleNamespace(id=uuid.uuid4(), project_id=uuid.uuid4(), oracle_project_id="52047", created_at=NOW)
    assert _oracle_id_read(item, {"52047": "KPO Project"}).project_description == "KPO Project"
    assert _oracle_id_read(item, {}).project_description is None


# --- endpoint gate ----------------------------------------------------------


@pytest.mark.asyncio
async def test_profile_endpoint_is_for_creators_only(client, override_auth):
    url = "/api/v1/project-creation-requests/oracle-project-profile/52047"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=override_auth(RoleCode.PROJECT_MANAGER))).status_code == 403
    assert (await client.get(url, headers=override_auth(RoleCode.DELIVERY_EXCELLENCE))).status_code == 403
