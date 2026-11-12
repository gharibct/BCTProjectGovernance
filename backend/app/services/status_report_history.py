"""Audit trail for status reports (Project / Account / Geo): one append-only row
per submit, recall, approve / reject, revoke and baseline, so earlier review cycles
survive the columns on the report itself being overwritten."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.status_report_history import StatusReportHistory
from app.models.users import User
from app.schemas.enums import ReportStatus
from app.schemas.status_report_history import StatusReportHistoryRead

PROJECT = "Project"
ACCOUNT = "Account"
GEO = "Geo"

_EVENT_BY_TARGET = {
    ReportStatus.SUBMITTED.value: "Submitted",
    ReportStatus.APPROVED.value: "Approved",
    ReportStatus.REJECTED.value: "Rejected",
    ReportStatus.BASELINED.value: "Baselined",
}
_RECALLABLE = {ReportStatus.SUBMITTED.value, ReportStatus.BASELINED.value}


def _event_for(prior: str | None, new: str) -> str | None:
    if prior == ReportStatus.APPROVED.value and new in (ReportStatus.SUBMITTED.value, ReportStatus.DRAFT.value):
        return "Revoked"  # the reviewer took an Approved report back
    if new in _EVENT_BY_TARGET:
        return _EVENT_BY_TARGET[new]
    if prior in _RECALLABLE:  # Submitted / Baselined -> back to a draft state
        return "Recalled"
    return None  # plain draft saves are not audited


async def record_transition(
    db: AsyncSession,
    report_type: str,
    report_id: UUID,
    actor_id: UUID | None,
    prior_status: str | None,
    new_status: str,
    comment: str | None = None,
) -> None:
    """Log a status change; a no-op when the status did not change or the move is a draft save."""
    prior = str(prior_status) if prior_status is not None else None
    new = str(new_status)
    if prior == new:
        return
    event = _event_for(prior, new)
    if event is None:
        return
    db.add(
        StatusReportHistory(
            id=uuid4(),
            report_type=report_type,
            report_id=report_id,
            event_type=event,
            from_status=prior,
            to_status=new,
            comment=comment or None,
            actor_id=actor_id,
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()


async def list_history(db: AsyncSession, report_type: str, report_id: UUID) -> list[StatusReportHistoryRead]:
    rows = (
        await db.execute(
            select(StatusReportHistory, User.full_name)
            .outerjoin(User, User.id == StatusReportHistory.actor_id)
            .where(StatusReportHistory.report_type == report_type, StatusReportHistory.report_id == report_id)
            .order_by(StatusReportHistory.created_at)
        )
    ).all()
    return [
        StatusReportHistoryRead(
            id=h.id,
            event_type=h.event_type,
            from_status=h.from_status,
            to_status=h.to_status,
            comment=h.comment,
            actor_id=h.actor_id,
            actor_name=name,
            created_at=h.created_at,
        )
        for h, name in rows
    ]
