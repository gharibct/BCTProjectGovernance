import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.master_data.generate_template import build_workbook
from app.master_data.import_template import run_import
from app.master_data.introspection import discover_tables

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def session_factory(tmp_path):
    """An isolated, throwaway sqlite DB per test — never the app's configured
    settings.database_url, which may point at a real shared Postgres server."""
    db_path = tmp_path / "master_data_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


def _set_row(ws, headers, values, row=2):
    stripped = [h[:-2] if h and h.endswith(" *") else h for h in headers]
    for key, value in values.items():
        ws.cell(row=row, column=stripped.index(key) + 1, value=value)


def _headers(ws):
    return [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]


def _base_workbook():
    wb = build_workbook(discover_tables())
    _set_row(wb["roles"], _headers(wb["roles"]), {"Code": "ADMIN", "Name": "Administrator"})
    _set_row(wb["geos"], _headers(wb["geos"]), {"Code": "APAC", "Name": "Asia Pacific", "Is Active": "Y"})
    _set_row(wb["organizations"], _headers(wb["organizations"]), {"Code": "BCTPL", "Name": "BCT", "Is Active": "Y"})
    _set_row(wb["project_types"], _headers(wb["project_types"]), {"Code": "DEV", "Name": "Development", "Is Active": "Y"})
    _set_row(wb["accounts"], _headers(wb["accounts"]), {"Name": "Acme", "Is Active": "Y", "Geo": "APAC"})
    _set_row(
        wb["users"],
        _headers(wb["users"]),
        {
            "Ldap Username": "jdoe",
            "Full Name": "Jane Doe",
            "Email": "jane@example.com",
            "Is Active": "Y",
            "MFA Enrolled": "N",
            "Role": "ADMIN",
        },
    )
    _set_row(
        wb["projects"],
        _headers(wb["projects"]),
        {
            "Project Code": "PRJ-1",
            "Project Name": "Test Project",
            "Project Status": "Draft",
            "Geo": "APAC",
            "Account": "Acme",
            "Organization": "BCTPL",
            "Project Type": "DEV",
        },
    )
    return wb


async def test_round_trip_insert_and_fk_resolution(session_factory, tmp_path):
    wb = _base_workbook()
    _set_row(
        wb["risk_log"],
        _headers(wb["risk_log"]),
        {"Risk Title": "Risk A", "Current Status": "Open", "Escalation Required": "N", "Project": "PRJ-1"},
    )
    _set_row(wb["issue_log"], _headers(wb["issue_log"]), {"Issue Title": "Issue A", "Status": "New", "Project": "PRJ-1"})

    path = tmp_path / "filled.xlsx"
    wb.save(path)

    result = await run_import(str(path), apply=True, only=None, session_factory=session_factory)

    assert result.errors == []
    assert result.applied is True
    assert result.stats["projects"].inserted == 1
    assert result.stats["risk_log"].inserted == 1
    assert result.stats["issue_log"].inserted == 1

    async with session_factory() as session:
        risk_log = Base.metadata.tables["risk_log"]
        rows = (await session.execute(select(risk_log.c.risk_code, risk_log.c.current_status))).all()
        assert len(rows) == 1
        assert rows[0].risk_code.startswith("RSK-")
        assert rows[0].current_status == "Open"


async def test_second_import_updates_not_duplicates(session_factory, tmp_path):
    wb = _base_workbook()
    path = tmp_path / "v1.xlsx"
    wb.save(path)
    result = await run_import(str(path), apply=True, only=None, session_factory=session_factory)
    assert result.errors == []

    wb2 = _base_workbook()
    _set_row(wb2["projects"], _headers(wb2["projects"]), {"Project Name": "Renamed Project"})
    path2 = tmp_path / "v2.xlsx"
    wb2.save(path2)
    result2 = await run_import(str(path2), apply=True, only=None, session_factory=session_factory)

    assert result2.errors == []
    assert result2.stats["projects"].inserted == 0
    assert result2.stats["projects"].updated == 1

    async with session_factory() as session:
        projects = Base.metadata.tables["projects"]
        rows = (await session.execute(select(projects.c.project_name))).all()
        assert len(rows) == 1
        assert rows[0].project_name == "Renamed Project"


async def test_bad_enum_value_reported_and_run_rolled_back(session_factory, tmp_path):
    wb = _base_workbook()
    headers = _headers(wb["projects"])
    stripped = [h[:-2] if h.endswith(" *") else h for h in headers]
    wb["projects"].cell(row=2, column=stripped.index("Project Status") + 1, value="Not A Real Status")

    path = tmp_path / "bad.xlsx"
    wb.save(path)

    result = await run_import(str(path), apply=True, only=None, session_factory=session_factory)

    assert result.applied is False
    assert len(result.errors) == 1
    assert result.errors[0].sheet == "projects"
    assert "Project Status" in result.errors[0].message

    async with session_factory() as session:
        roles = Base.metadata.tables["roles"]
        count = (await session.execute(select(func.count()).select_from(roles))).scalar_one()
        assert count == 0
