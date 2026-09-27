"""Project Resource Allocation page — reads the Oracle man-month tables through the
project's mapped Oracle project IDs. Loads a small workbook with the real importer
into in-memory SQLite, so the tables are filled exactly as in production."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.oracle_man_month import (
    IntegrationLoadRun,
    IntegrationManMonth,
    OracleEmployeeMaster,
    OracleProjectAllocation,
    OracleProjectMaster,
    OracleProjectMonthAllocation,
)
from app.models.projects import ProjectOracleId
from app.models.reference_data import Geo, Region
from app.services.man_month_import import load_man_month, parse_workbook
from app.services.oracle_resource_allocation import (
    list_resource_allocations,
    resource_allocation_detail,
    resource_allocation_summary,
)
from tests.test_man_month_import import _row, _write

TODAY = date(2026, 9, 24)
PROJECT_ID = uuid.uuid4()


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    tables = [
        Geo, Region, IntegrationLoadRun, IntegrationManMonth, OracleEmployeeMaster, OracleProjectMaster,
        OracleProjectAllocation, OracleProjectMonthAllocation, ProjectOracleId,
    ]  # fmt: skip
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[t.__table__ for t in tables]))
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


async def _load(db, tmp_path, rows, today, name):
    await load_man_month(db, parse_workbook(_write(tmp_path / name, rows), today), name)


@pytest.fixture
async def seeded(db, tmp_path):
    aug = [
        _row("100", "Anita Rao", "P1", 0.97),
        _row("100", "Anita Rao", "P1", 0.03, alloc_start=date(2026, 2, 2), alloc_end=date(2026, 8, 1)),
        _row("200", "Bala Anand", "P1", 1, alloc_start=date(2026, 1, 1), alloc_end=None),  # open-ended
        _row("300", "Anand Kumar", "P1", 1, alloc_start=date(2026, 1, 1), alloc_end=date(2026, 8, 15)),  # ended in Aug
        _row("400", "Chitra", "P2", 1),  # a different Oracle project, not mapped
        _row("500", "Deepak_100%", "P1", 0.5),
    ]
    await _load(db, tmp_path, aug, date(2026, 9, 24), "aug.xlsx")
    # The helper's SEP column is always 1.
    sep = [_row("100", "Anita Rao", "P1", 1), _row("200", "Bala Anand", "P1", 1, alloc_start=date(2026, 1, 1), alloc_end=None)]
    await _load(db, tmp_path, sep, date(2026, 10, 5), "sep.xlsx")
    db.add(ProjectOracleId(id=uuid.uuid4(), project_id=PROJECT_ID, oracle_project_id="P1", created_at=datetime.now(UTC)))
    await db.flush()
    return db


async def test_summary_counts_resources_allocated_this_month_and_man_months_to_date(seeded):
    summary = await resource_allocation_summary(seeded, PROJECT_ID, today=TODAY)
    # September: 100, 200 and 500 overlap it; 300 ended in August; 400 is on P2.
    assert summary.resources_allocated_this_month == 3
    # Aug: .97+.03+1+1+.5 = 3.5, Sep: 1+1 = 2
    assert summary.man_months_consumed == Decimal("5.5000")


async def test_summary_ignores_months_after_today(seeded):
    summary = await resource_allocation_summary(seeded, PROJECT_ID, today=date(2026, 8, 31))
    assert summary.man_months_consumed == Decimal("3.5000")  # Sep-26 hasn't started yet


async def test_summary_is_zero_when_no_oracle_project_is_mapped(seeded):
    summary = await resource_allocation_summary(seeded, uuid.uuid4(), today=TODAY)
    assert (summary.resources_allocated_this_month, summary.man_months_consumed) == (0, Decimal("0"))


async def test_list_has_one_row_per_resource_with_the_span_and_total(seeded):
    rows, total = await list_resource_allocations(seeded, PROJECT_ID, search=None, skip=0, limit=50)
    assert total == 4
    by_code = {r.employee_code: r for r in rows}
    assert set(by_code) == {"100", "200", "300", "500"}  # 400 is on an unmapped project

    anita = by_code["100"]
    assert anita.employee_name == "Anita Rao" and anita.location == "Chennai"
    assert anita.allocation_start_date == date(2026, 2, 2)  # earliest of her two periods
    assert anita.allocation_end_date == date(2027, 3, 31)  # latest end
    assert anita.total_man_months == Decimal("2.0000")  # Aug .97 + .03, Sep 1
    assert by_code["200"].allocation_end_date is None  # open-ended
    assert by_code["300"].allocation_end_date == date(2026, 8, 15)


async def test_list_is_ordered_by_name_and_paginated(seeded):
    page1, total = await list_resource_allocations(seeded, PROJECT_ID, search=None, skip=0, limit=2)
    page2, _ = await list_resource_allocations(seeded, PROJECT_ID, search=None, skip=2, limit=2)
    assert total == 4
    names = [r.employee_name for r in page1 + page2]
    assert len(page1) == 2 and len(page2) == 2
    assert names == sorted(names) and len(set(names)) == 4  # no row repeated or skipped across pages


async def test_search_matches_the_name_anywhere_case_insensitively(seeded):
    rows, total = await list_resource_allocations(seeded, PROJECT_ID, search="AN", skip=0, limit=50)
    assert {r.employee_name for r in rows} == {"Anita Rao", "Bala Anand", "Anand Kumar"}
    assert total == 3
    rows, _ = await list_resource_allocations(seeded, PROJECT_ID, search=" nand", skip=0, limit=50)
    assert {r.employee_name for r in rows} == {"Bala Anand", "Anand Kumar"}


async def test_search_treats_like_wildcards_literally(seeded):
    rows, _ = await list_resource_allocations(seeded, PROJECT_ID, search="_100%", skip=0, limit=50)
    assert [r.employee_name for r in rows] == ["Deepak_100%"]
    rows, _ = await list_resource_allocations(seeded, PROJECT_ID, search="%", skip=0, limit=50)
    assert [r.employee_name for r in rows] == ["Deepak_100%"]  # a bare % isn't "match everything"


async def test_list_for_a_project_without_mapped_oracle_projects_is_empty(seeded):
    assert await list_resource_allocations(seeded, uuid.uuid4(), search=None, skip=0, limit=50) == ([], 0)


async def test_detail_gives_month_wise_allocation_summed_per_month(seeded):
    employee = (await list_resource_allocations(seeded, PROJECT_ID, search="Anita", skip=0, limit=1))[0][0]
    detail = await resource_allocation_detail(seeded, PROJECT_ID, employee.employee_id)
    assert detail is not None
    assert [(m.month, m.month_start, m.man_month) for m in detail.months] == [
        ("Aug-26", date(2026, 8, 1), Decimal("1.0000")),  # .97 + .03 from her two periods
        ("Sep-26", date(2026, 9, 1), Decimal("1.0000")),
    ]
    assert detail.total_man_months == Decimal("2.0000")
    assert [p.allocation_start_date for p in detail.periods] == [date(2026, 2, 2), date(2026, 8, 2)]
    assert (detail.employee_code, detail.location) == ("100", "Chennai")


async def test_detail_is_none_for_a_resource_not_on_the_project(seeded):
    rows, _ = await list_resource_allocations(seeded, PROJECT_ID, search=None, skip=0, limit=50)
    assert await resource_allocation_detail(seeded, uuid.uuid4(), rows[0].employee_id) is None  # other project
    assert await resource_allocation_detail(seeded, PROJECT_ID, uuid.uuid4()) is None  # unknown employee


# --- endpoint gate ----------------------------------------------------------


async def test_endpoints_require_a_session(client):
    for suffix in ("", "/summary", f"/{uuid.uuid4()}/months"):
        response = await client.get(f"/api/v1/projects/{PROJECT_ID}/resource-allocation{suffix}")
        assert response.status_code == 401, suffix
