from uuid import uuid4

import pytest

from app.schemas.enums import ReportStatus
from app.services import status_report_history as svc


class _FakeDb:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass


@pytest.mark.parametrize(
    ("prior", "new", "event"),
    [
        (None, ReportStatus.SUBMITTED, "Submitted"),
        (ReportStatus.REJECTED, ReportStatus.SUBMITTED, "Submitted"),
        (ReportStatus.SUBMITTED, ReportStatus.APPROVED, "Approved"),
        (ReportStatus.SUBMITTED, ReportStatus.REJECTED, "Rejected"),
        (ReportStatus.SUBMITTED, ReportStatus.DRAFT, "Recalled"),
        (ReportStatus.BASELINED, ReportStatus.DRAFT_SAVED, "Recalled"),
        (None, ReportStatus.BASELINED, "Baselined"),
    ],
)
async def test_records_audited_transitions(prior, new, event):
    db = _FakeDb()
    await svc.record_transition(db, svc.PROJECT, uuid4(), uuid4(), prior, new, "note")
    assert [h.event_type for h in db.added] == [event]
    assert db.added[0].comment == "note"
    assert db.added[0].to_status == str(new)


@pytest.mark.parametrize(
    ("prior", "new"),
    [
        (None, ReportStatus.DRAFT),  # draft creation
        (ReportStatus.DRAFT, ReportStatus.DRAFT),  # plain save
        (ReportStatus.SUBMITTED, ReportStatus.SUBMITTED),  # no change
        (ReportStatus.REJECTED, ReportStatus.DRAFT),  # draft save after rejection
    ],
)
async def test_ignores_draft_saves(prior, new):
    db = _FakeDb()
    await svc.record_transition(db, svc.PROJECT, uuid4(), uuid4(), prior, new)
    assert db.added == []
