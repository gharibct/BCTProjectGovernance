import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import openpyxl
import pytest
from sqlalchemy import func, select
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
from app.models.reference_data import Geo, Region
from app.services.man_month_import import (
    ManMonthFileError,
    ManMonthRow,
    collapse_allocations,
    collapse_by_key,
    load_man_month,
    parse_workbook,
    record_failed_run,
    resolve_target_month,
)

HEADERS = [
    "Employee Geo", "Operating Unit", "Account",
    "Employee Number", "Name", "Employment Type", "Designation", "Grade", "Department",
    "Role",
    "Project Number", "Project Name", "Project Type", "Project OU", "Project Geo",
    "Project Start Date", "Project End Date", "Project SBU Code", "Project SBU Name", "Project Practice",
    "Percentage Allocation", "Allocation Start Date", "Allocation End Date",
    "DOJ", "Termination Date", "Location",
    "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR",
]  # fmt: skip


def _row(
    emp, name, proj, aug, *, pname=None, grade="G2", alloc_start=date(2026, 8, 2),
    alloc_end=date(2027, 3, 31), pct="100", termination=None, account="Acme", pgeo="BCT US",
):  # fmt: skip
    d = date(2026, 1, 1)
    return [
        "BCT INDIA", "BCT Consulting", account,
        emp, name, "Regular", "Engineer", grade, "COE",
        "Team Member",
        proj, pname or f"Project {proj}", "T&M", "BCT Digital", pgeo,
        d, date(2027, 3, 31), "236", "SBU - KPO", "COE - KPO",
        pct, alloc_start, alloc_end,
        date(2025, 9, 8), termination, "Chennai",
        None, None, None, None, aug, 1, 1, 1, 1, 1, 1, 1,
    ]  # fmt: skip


def _write(path, rows, headers=HEADERS):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    wb.save(path)
    return path


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    tables = [
        Geo.__table__,
        Region.__table__,
        IntegrationLoadRun.__table__,
        IntegrationManMonth.__table__,
        OracleEmployeeMaster.__table__,
        OracleProjectMaster.__table__,
        OracleProjectAllocation.__table__,
        OracleProjectMonthAllocation.__table__,
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


async def _count(db, model):
    return (await db.execute(select(func.count()).select_from(model))).scalar_one()


async def _load(db, tmp_path, rows, today=date(2026, 9, 24), name="f.xlsx"):
    parsed = parse_workbook(_write(tmp_path / name, rows), today)
    return await load_man_month(db, parsed, name)


# --- month rule -------------------------------------------------------------


@pytest.mark.parametrize(
    ("today", "column", "label", "month_start"),
    [
        (date(2026, 9, 24), "AUG", "Aug-26", date(2026, 8, 1)),
        (date(2026, 9, 1), "AUG", "Aug-26", date(2026, 8, 1)),
        (date(2027, 1, 15), "DEC", "Dec-26", date(2026, 12, 1)),  # January -> previous year's December
        (date(2026, 4, 30), "MAR", "Mar-26", date(2026, 3, 1)),
        (date(2026, 3, 31), "FEB", "Feb-26", date(2026, 2, 1)),
    ],
)
def test_target_month_is_the_previous_calendar_month(today, column, label, month_start):
    m = resolve_target_month(today)
    assert (m.column, m.label, m.month_start) == (column, label, month_start)


# --- parsing ----------------------------------------------------------------


def test_parse_picks_only_the_previous_month_column(tmp_path):
    path = _write(tmp_path / "f.xlsx", [_row("100", "A", "P1", 0.84)])
    parsed = parse_workbook(path, date(2026, 9, 24))
    assert parsed.month.label == "Aug-26"
    assert parsed.rows[0].man_month == Decimal("0.8400")  # AUG, not the SEP value of 1
    assert parsed.rows[0].percentage_allocation == Decimal("100.00")


def test_parse_reads_the_employee_and_project_columns(tmp_path):
    path = _write(tmp_path / "f.xlsx", [_row("100", "A", "P1", 1, termination=date(2026, 9, 30))])
    row = parse_workbook(path, date(2026, 9, 24)).rows[0]
    assert (row.employee_geo, row.operating_unit, row.location) == ("BCT INDIA", "BCT Consulting", "Chennai")
    assert (row.doj, row.termination_date) == (date(2025, 9, 8), date(2026, 9, 30))
    assert (row.account_name, row.project_ou) == ("Acme", "BCT Digital")
    assert (row.project_sbu_code, row.project_sbu_name, row.project_practice) == ("236", "SBU - KPO", "COE - KPO")


def test_parse_keeps_numeric_ids_as_text_and_blank_month_as_none(tmp_path):
    path = _write(tmp_path / "f.xlsx", [_row(150562.0, "A", 52047, None)])
    row = parse_workbook(path, date(2026, 9, 24)).rows[0]
    assert (row.employee_number, row.project_number) == ("150562", "52047")
    assert row.man_month is None


def test_parse_skips_rows_missing_a_key_and_reports_them(tmp_path):
    path = _write(tmp_path / "f.xlsx", [_row(None, "A", "P1", 1), _row("2", "B", None, 1), _row("3", "C", "P1", 1)])
    parsed = parse_workbook(path, date(2026, 9, 24))
    assert [r.employee_number for r in parsed.rows] == ["3"]
    assert parsed.rows_read == 3 and len(parsed.skipped) == 2


def test_parse_blanks_a_bad_optional_value_but_skips_a_bad_month_value(tmp_path):
    bad_date = _row("1", "A", "P1", 1)
    bad_date[HEADERS.index("Allocation Start Date")] = "not a date"
    bad_month = _row("2", "B", "P1", "n/a")
    parsed = parse_workbook(_write(tmp_path / "f.xlsx", [bad_date, bad_month]), date(2026, 9, 24))
    assert [r.employee_number for r in parsed.rows] == ["1"]
    assert parsed.rows[0].allocation_start_date is None
    assert len(parsed.warnings) == 1 and len(parsed.skipped) == 1  # one warning per row, not two


def test_parse_warns_when_the_allocation_start_date_is_blank(tmp_path):
    parsed = parse_workbook(_write(tmp_path / "f.xlsx", [_row("1", "A", "P1", 1, alloc_start=None)]), date(2026, 9, 24))
    assert len(parsed.rows) == 1
    assert len(parsed.warnings) == 1 and "allocation start date" in parsed.warnings[0]


def test_parse_rejects_a_file_without_the_month_column(tmp_path):
    path = _write(tmp_path / "f.xlsx", [], headers=[h for h in HEADERS if h != "AUG"])
    with pytest.raises(ManMonthFileError, match="aug"):
        parse_workbook(path, date(2026, 9, 24))


@pytest.mark.parametrize("header", ["Account", "DOJ", "Project SBU Code", "Allocation Start Date"])
def test_parse_rejects_a_file_missing_a_required_column(tmp_path, header):
    path = _write(tmp_path / "f.xlsx", [], headers=[h for h in HEADERS if h != header])
    with pytest.raises(ManMonthFileError, match=header.lower()):
        parse_workbook(path, date(2026, 9, 24))


# --- derivation -------------------------------------------------------------


def test_collapse_takes_last_non_blank_and_reports_conflicts():
    rows = [
        ManMonthRow(1, "E1", "P1", "N", name="Mr. Harish Elati", grade="G2"),
        ManMonthRow(2, "E1", "P2", "N", name="Harish Elati", grade=None),
        ManMonthRow(3, "E1", "P3", "N", name=None),
    ]
    merged, conflicts = collapse_by_key(rows, "employee_number", ("name", "grade"))
    assert merged["E1"] == {"name": "Harish Elati", "grade": "G2"}
    assert conflicts == {"E1": {"name": {"Mr. Harish Elati", "Harish Elati"}}}


def test_allocations_are_keyed_by_start_date_skip_rows_without_one_and_keep_zero():
    aug2, feb2 = date(2026, 8, 2), date(2026, 2, 2)
    rows = [
        ManMonthRow(1, "E1", "P1", "N", man_month=Decimal("0.97"), allocation_start_date=aug2),
        ManMonthRow(2, "E1", "P1", "N", man_month=Decimal("0.03"), allocation_start_date=feb2),
        ManMonthRow(3, "E1", "P2", "N", man_month=None, allocation_start_date=aug2),
        ManMonthRow(4, "E2", "P1", "N", man_month=Decimal("0"), allocation_start_date=aug2),
        ManMonthRow(5, "E3", "P1", "N", man_month=Decimal("1"), allocation_start_date=None),
    ]
    merged = collapse_allocations(rows)
    assert {k: v.man_month for k, v in merged.items()} == {
        ("E1", "P1", aug2): Decimal("0.97"),
        ("E1", "P1", feb2): Decimal("0.03"),  # the split stays attributable to its own period
        ("E1", "P2", aug2): None,
        ("E2", "P1", aug2): Decimal("0"),
    }


def test_allocation_takes_last_non_blank_end_date_and_percentage():
    start = date(2026, 8, 2)
    rows = [
        ManMonthRow(1, "E1", "P1", "N", allocation_start_date=start, percentage_allocation=Decimal("50"),
                    allocation_end_date=date(2026, 12, 31)),
        ManMonthRow(2, "E1", "P1", "N", allocation_start_date=start),
    ]  # fmt: skip
    record = collapse_allocations(rows)[("E1", "P1", start)]
    assert (record.percentage_allocation, record.allocation_end_date) == (Decimal("50"), date(2026, 12, 31))
    assert record.source_row_count == 2


# --- load -------------------------------------------------------------------


async def test_load_populates_all_four_tables_and_the_base_table(db, tmp_path):
    rows = [
        _row("100", "Mr. A", "P1", 0.97),
        _row("100", "Mr. A", "P1", 0.03, alloc_start=date(2026, 2, 2), alloc_end=date(2026, 8, 1)),  # same pair, earlier period
        _row("100", "Mr. A", "P2", None),  # no value this month -> allocation but no month allocation
        _row("200", "B", "P1", 1, termination=date(2026, 12, 31)),
    ]
    summary = await _load(db, tmp_path, rows)

    assert (summary.employees_inserted, summary.projects_inserted) == (2, 2)
    assert summary.project_allocations_inserted == 4
    assert summary.allocations_written == 3
    assert await _count(db, IntegrationManMonth) == 4  # every source row is kept
    base = (await db.execute(select(IntegrationManMonth).limit(1))).scalar_one()
    assert (base.month, base.month_start) == ("Aug-26", date(2026, 8, 1))
    assert (base.account_name, base.location, base.project_sbu_name) == ("Acme", "Chennai", "SBU - KPO")

    emp = (await db.execute(select(OracleEmployeeMaster).where(OracleEmployeeMaster.employee_number == "200"))).scalar_one()
    assert (emp.employee_geo, emp.operating_unit, emp.location) == ("BCT INDIA", "BCT Consulting", "Chennai")
    assert (emp.doj, emp.termination_date) == (date(2025, 9, 8), date(2026, 12, 31))
    proj = (await db.execute(select(OracleProjectMaster).where(OracleProjectMaster.project_number == "P1"))).scalar_one()
    assert (proj.account_name, proj.project_ou, proj.project_sbu_code, proj.project_practice) == (
        "Acme", "BCT Digital", "236", "COE - KPO",
    )  # fmt: skip

    allocs = (
        await db.execute(
            select(OracleProjectAllocation, OracleEmployeeMaster.employee_number, OracleProjectMaster.project_number)
            .join(OracleEmployeeMaster, OracleEmployeeMaster.id == OracleProjectAllocation.employee_id)
            .join(OracleProjectMaster, OracleProjectMaster.id == OracleProjectAllocation.project_id)
        )
    ).all()
    by_key = {(e, p, a.allocation_start_date): a for a, e, p in allocs}
    aug = by_key[("100", "P1", date(2026, 8, 2))]
    assert (aug.percentage_allocation, aug.allocation_end_date) == (Decimal("100.00"), date(2027, 3, 31))
    assert by_key[("100", "P1", date(2026, 2, 2))].allocation_end_date == date(2026, 8, 1)
    assert ("100", "P2", date(2026, 8, 2)) in by_key

    # Each month allocation hangs off its own allocation period.
    months = {
        m.allocation_id: m.man_month for m in (await db.execute(select(OracleProjectMonthAllocation))).scalars()
    }
    assert months[aug.id] == Decimal("0.9700")
    assert months[by_key[("100", "P1", date(2026, 2, 2))].id] == Decimal("0.0300")
    assert by_key[("100", "P2", date(2026, 8, 2))].id not in months


async def test_reloading_the_same_month_is_idempotent(db, tmp_path):
    rows = [_row("100", "A", "P1", 1), _row("200", "B", "P1", 1)]
    await _load(db, tmp_path, rows)
    second = await _load(db, tmp_path, rows)

    assert (second.employees_inserted, second.employees_updated) == (0, 0)
    assert (second.project_allocations_inserted, second.project_allocations_updated) == (0, 0)
    assert second.allocations_removed == 2 and second.allocations_written == 2
    assert await _count(db, IntegrationManMonth) == 2
    assert await _count(db, OracleEmployeeMaster) == 2
    assert await _count(db, OracleProjectAllocation) == 2
    assert await _count(db, OracleProjectMonthAllocation) == 2
    assert await _count(db, IntegrationLoadRun) == 2  # one audit row per run


async def test_reload_updates_changed_attributes_and_keeps_vanished_allocations_as_history(db, tmp_path):
    await _load(db, tmp_path, [_row("100", "A", "P1", 1), _row("200", "B", "P1", 1)], name="a.xlsx")

    second_rows = [_row("100", "A", "P1", 1, grade="G3", pname="Renamed", alloc_end=date(2027, 9, 30), pct="50")]
    summary = await _load(db, tmp_path, second_rows, name="b.xlsx")

    assert (summary.employees_updated, summary.projects_updated) == (1, 1)
    assert (summary.project_allocations_inserted, summary.project_allocations_updated) == (0, 1)
    assert await _count(db, IntegrationManMonth) == 1
    emp = (await db.execute(select(OracleEmployeeMaster).where(OracleEmployeeMaster.employee_number == "100"))).scalar_one()
    proj = (await db.execute(select(OracleProjectMaster))).scalar_one()
    assert (emp.grade, proj.project_name) == ("G3", "Renamed")
    assert await _count(db, OracleEmployeeMaster) == 2  # 200 stays in the master (history)

    assert await _count(db, OracleProjectAllocation) == 2  # 200's allocation stays too
    changed = (
        await db.execute(
            select(OracleProjectAllocation)
            .join(OracleEmployeeMaster, OracleEmployeeMaster.id == OracleProjectAllocation.employee_id)
            .where(OracleEmployeeMaster.employee_number == "100")
        )
    ).scalar_one()
    assert (changed.allocation_end_date, changed.percentage_allocation) == (date(2027, 9, 30), Decimal("50.00"))
    assert await _count(db, OracleProjectMonthAllocation) == 1  # this month's set was replaced: only 100's is left


async def test_allocation_without_a_start_date_still_feeds_the_masters_but_gets_no_allocation(db, tmp_path):
    summary = await _load(db, tmp_path, [_row("100", "A", "P1", 1, alloc_start=None)])
    assert (summary.employees_inserted, summary.projects_inserted) == (1, 1)
    assert summary.project_allocations_inserted == 0 and summary.allocations_written == 0
    assert await _count(db, IntegrationManMonth) == 1
    assert await _count(db, OracleProjectAllocation) == 0


async def test_blank_value_does_not_overwrite_and_older_month_does_not_clobber(db, tmp_path):
    await _load(db, tmp_path, [_row("100", "New Name", "P1", 1, grade="G4", alloc_end=date(2028, 1, 31))],
                today=date(2026, 10, 5), name="s.xlsx")  # Sep-26  # fmt: skip

    aug_rows = [_row("100", "Old Name", "P1", 1, grade="G1", alloc_end=date(2027, 3, 31))]
    await _load(db, tmp_path, aug_rows, today=date(2026, 9, 5), name="a.xlsx")  # Aug-26, loaded later

    emp = (await db.execute(select(OracleEmployeeMaster))).scalar_one()
    assert (emp.name, emp.grade) == ("New Name", "G4")  # newer month's attributes win
    assert (emp.first_seen_month, emp.last_seen_month) == (date(2026, 8, 1), date(2026, 9, 1))
    alloc = (await db.execute(select(OracleProjectAllocation))).scalar_one()  # same period seen in both months
    assert alloc.allocation_end_date == date(2028, 1, 31)
    assert (alloc.first_seen_month, alloc.last_seen_month) == (date(2026, 8, 1), date(2026, 9, 1))
    assert await _count(db, OracleProjectMonthAllocation) == 2  # one per month


async def test_months_accumulate_in_the_base_table(db, tmp_path):
    rows = [_row("100", "A", "P1", 1)]
    await _load(db, tmp_path, rows, today=date(2026, 9, 5), name="1.xlsx")
    await _load(db, tmp_path, rows, today=date(2026, 10, 5), name="2.xlsx")
    assert await _count(db, IntegrationManMonth) == 2


async def test_record_failed_run_persists_a_failed_row(db):
    await record_failed_run(db, resolve_target_month(date(2026, 9, 24)), "f.xlsx", "boom")
    run = (await db.execute(select(IntegrationLoadRun))).scalar_one()
    assert (run.status, run.error, run.month) == ("FAILED", "boom", "Aug-26")


# --- region / geo -----------------------------------------------------------


async def _seed_regions(db):
    now = datetime.now(UTC)
    us_geo = Geo(id=uuid.uuid4(), code="US", name="United States", is_active=True, created_at=now, updated_at=now)
    mea_geo = Geo(id=uuid.uuid4(), code="MEA", name="Middle East", is_active=True, created_at=now, updated_at=now)
    db.add_all([us_geo, mea_geo])
    await db.flush()
    us = Region(id=uuid.uuid4(), geo_id=us_geo.id, code="US", name="United States", is_active=True, created_at=now, updated_at=now)
    oman = Region(id=uuid.uuid4(), geo_id=mea_geo.id, code="OMAN", name="Oman", is_active=True, created_at=now, updated_at=now)
    db.add_all([us, oman])
    await db.flush()
    return us, oman


async def _project(db, number):
    return (await db.execute(select(OracleProjectMaster).where(OracleProjectMaster.project_number == number))).scalar_one()


async def test_load_resolves_each_projects_region_and_geo_from_project_geo(db, tmp_path):
    us, oman = await _seed_regions(db)
    summary = await _load(
        db,
        tmp_path,
        [_row("1", "A", "P1", 1, pgeo="BCT US"), _row("2", "B", "P2", 1, pgeo="BCT OMAN")],
    )
    p1, p2 = await _project(db, "P1"), await _project(db, "P2")
    assert (p1.region_id, p1.geo_id) == (us.id, us.geo_id)
    assert (p2.region_id, p2.geo_id) == (oman.id, oman.geo_id)
    assert summary.unmapped_project_geos == {}


async def test_unmatched_project_geo_leaves_region_and_geo_blank_and_is_reported(db, tmp_path):
    await _seed_regions(db)
    summary = await _load(
        db,
        tmp_path,
        [_row("1", "A", "P1", 1, pgeo="BCT MARS"), _row("2", "B", "P2", 1, pgeo="BCT MARS"), _row("3", "C", "P3", 1, pgeo=None)],
    )
    for number in ("P1", "P2", "P3"):
        project = await _project(db, number)
        assert (project.region_id, project.geo_id) == (None, None)
    assert summary.unmapped_project_geos == {"BCT MARS": 2}  # a blank geo isn't "unmapped"


async def test_reload_fills_region_once_it_exists_and_a_blank_does_not_clear_it(db, tmp_path):
    await _load(db, tmp_path, [_row("1", "A", "P1", 1, pgeo="BCT US")], name="a.xlsx")
    assert (await _project(db, "P1")).region_id is None  # regions not set up yet

    us, _ = await _seed_regions(db)
    await _load(db, tmp_path, [_row("1", "A", "P1", 1, pgeo="BCT US")], name="b.xlsx")
    assert (await _project(db, "P1")).region_id == us.id

    await _load(db, tmp_path, [_row("1", "A", "P1", 1, pgeo=None)], name="c.xlsx")
    assert (await _project(db, "P1")).region_id == us.id
