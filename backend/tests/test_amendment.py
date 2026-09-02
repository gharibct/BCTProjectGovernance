"""Unit test for app.services.amendment.initiate_amendment — verifies it
snapshots each project-data row, flips the project to Under Amendment, and
clears the in-flight DE review fields. A stub db answers the per-table SELECTs.
"""

from uuid import uuid4

import pytest

from app.models.amendment import ProjectAmendment, ProjectAmendmentSnapshot
from app.models.contractual import ContractualCommitment
from app.models.projects import Project
from app.models.raid import RiskLog
from app.services.amendment import initiate_amendment

pytestmark = pytest.mark.asyncio

_PID = uuid4()


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)


class StubDB:
    """Returns canned rows for tables named in `rows_by_table` (matched on the
    compiled `FROM <table>`), empty otherwise. Collects db.add() objects."""

    def __init__(self, rows_by_table):
        self._rows_by_table = rows_by_table
        self.added: list = []

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def execute(self, stmt):
        sql = str(stmt).lower()
        for table, rows in self._rows_by_table.items():
            if f"from {table}" in sql and "priority" not in sql:
                return _ScalarResult(rows)
        return _ScalarResult([])


async def test_initiate_amendment_snapshots_and_flips_status():
    project = Project(
        id=_PID,
        project_code="PRJ-9",
        project_name="Amendable",
        project_status="Approved",
        de_review_status="Approved",
        de_review_remarks="ok",
    )
    commitments = [
        ContractualCommitment(id=uuid4(), project_id=_PID, commitment_name="SLA", frequency="Monthly", penalty_applicable=False),
        ContractualCommitment(id=uuid4(), project_id=_PID, commitment_name="Report", frequency="Weekly", penalty_applicable=False),
    ]
    risks = [RiskLog(id=uuid4(), project_id=_PID, risk_code="R-1", risk_title="Scope creep", current_status="Open", escalation_required=False)]

    db = StubDB({"contractual_commitments": commitments, "risk_log": risks})
    amendment = await initiate_amendment(db, project, actor_id=uuid4())

    assert isinstance(amendment, ProjectAmendment)
    assert amendment.status == "In Progress"
    assert project.project_status == "Under Amendment"
    assert project.de_review_status is None
    assert project.de_review_remarks is None

    snapshots = [o for o in db.added if isinstance(o, ProjectAmendmentSnapshot)]
    tables = sorted(s.source_table for s in snapshots)
    # 1 projects row + 2 commitments + 1 risk
    assert tables == ["contractual_commitments", "contractual_commitments", "projects", "risk_log"]
    projects_snap = next(s for s in snapshots if s.source_table == "projects")
    assert projects_snap.row_data["project_code"] == "PRJ-9"
    assert projects_snap.row_data["project_status"] == "Approved"  # captured before the flip
