"""services/status_report.ensure_draft_report — the shared "reporting has
started for this period" guarantee that Measurement (and any future
period-scoped register) calls so the Project Dashboard shows a Draft even
when Project Status was never saved.
"""

from uuid import uuid4

import pytest

from app.models.project_status import ProjectStatusReport
from app.schemas.enums import ReportStatus
from app.services.status_report import ensure_draft_report

pytestmark = pytest.mark.asyncio


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _StubSession:
    """Just the surface ensure_draft_report / CRUDBase.create touch."""

    def __init__(self, existing_report_id=None):
        self._existing_report_id = existing_report_id
        self.added: list = []

    async def execute(self, _stmt):
        return _Result(self._existing_report_id)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def refresh(self, _obj):
        pass


async def test_creates_draft_report_when_period_has_none():
    db = _StubSession(existing_report_id=None)
    project_id, period_id = uuid4(), uuid4()

    await ensure_draft_report(db, project_id, period_id)

    assert len(db.added) == 1
    row = db.added[0]
    assert isinstance(row, ProjectStatusReport)
    assert row.project_id == project_id
    assert row.period_id == period_id
    assert row.status == ReportStatus.DRAFT


async def test_noop_when_period_already_has_a_report():
    db = _StubSession(existing_report_id=uuid4())

    await ensure_draft_report(db, uuid4(), uuid4())

    assert db.added == []
