"""Oracle Project ID validation for the Create Project flow: the ID must be in
oracle_project_master and mapped to at most one project, whatever its status."""

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models.oracle_man_month import IntegrationLoadRun, OracleProjectMaster
from app.models.project_creation_request import ProjectCreationRequest, ProjectCreationRequestOracleId
from app.models.projects import Project, ProjectOracleId
from app.services.oracle_id_validation import oracle_id_blockers

pytestmark = pytest.mark.asyncio

NOW = datetime.now(UTC)


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    tables = [IntegrationLoadRun, OracleProjectMaster, Project, ProjectOracleId, ProjectCreationRequest, ProjectCreationRequestOracleId]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[t.__table__ for t in tables]))
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        run = IntegrationLoadRun(
            id=uuid.uuid4(), source_name="X", source_file="f", month="Aug-26", month_start=date(2026, 8, 1),
            status="SUCCESS", rows_read=1, rows_loaded=1, rows_skipped=0, employees_inserted=0, employees_updated=0,
            projects_inserted=1, projects_updated=0, project_allocations_inserted=0, project_allocations_updated=0,
            allocations_written=0, allocations_removed=0, started_at=NOW,
        )  # fmt: skip
        session.add(run)
        await session.flush()
        for number in ("P-1", "P-2", "P-3", "P-4"):
            session.add(
                OracleProjectMaster(
                    id=uuid.uuid4(), project_number=number, project_name=f"Oracle {number}",
                    first_seen_month=date(2026, 8, 1), last_seen_month=date(2026, 8, 1),
                    last_load_run_id=run.id, created_at=NOW, updated_at=NOW,
                )
            )  # fmt: skip
        await session.flush()
        yield session
    await engine.dispose()


async def _project(db, code, status, oracle_id):
    project = Project(
        id=uuid.uuid4(), project_code=code, project_name=f"Project {code}", project_status=status,
        created_at=NOW, updated_at=NOW,
    )  # fmt: skip
    db.add(project)
    await db.flush()
    db.add(ProjectOracleId(id=uuid.uuid4(), project_id=project.id, oracle_project_id=oracle_id, created_at=NOW))
    await db.flush()


async def _request(db, status, oracle_id):
    request = ProjectCreationRequest(
        id=uuid.uuid4(), project_name="Requested", status=status, created_at=NOW, updated_at=NOW
    )
    db.add(request)
    await db.flush()
    db.add(
        ProjectCreationRequestOracleId(
            id=uuid.uuid4(), request_id=request.id, oracle_project_id=oracle_id, created_at=NOW
        )
    )
    await db.flush()
    return request


async def test_unknown_id_is_blocked(db):
    blockers = await oracle_id_blockers(db, ["NOPE"])
    assert "not found in the Oracle project master" in blockers["NOPE"]


async def test_free_id_in_master_is_allowed(db):
    assert await oracle_id_blockers(db, ["P-1"]) == {}


@pytest.mark.parametrize(
    "status", ["Draft", "Pending Approval", "Approved", "Under Amendment", "Closed"]
)
async def test_id_mapped_to_a_project_is_blocked_whatever_its_status(db, status):
    await _project(db, "PRJ-1", status, "P-2")
    blockers = await oracle_id_blockers(db, ["P-1", "P-2"])
    assert set(blockers) == {"P-2"}
    assert "PRJ-1" in blockers["P-2"]
    assert f"({status})" in blockers["P-2"]


async def test_id_on_a_pending_request_is_blocked_but_not_a_rejected_one(db):
    await _request(db, "Pending", "P-3")
    await _request(db, "Rejected", "P-4")
    blockers = await oracle_id_blockers(db, ["P-3", "P-4"])
    assert set(blockers) == {"P-3"}
    assert "pending creation request" in blockers["P-3"]


async def test_pending_check_can_exclude_own_request_or_be_skipped(db):
    own = await _request(db, "Pending", "P-3")
    assert await oracle_id_blockers(db, ["P-3"], exclude_request_id=own.id) == {}
    assert await oracle_id_blockers(db, ["P-3"], check_pending_requests=False) == {}
