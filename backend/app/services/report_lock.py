"""Shared submission-freeze guard for the 4 period-scoped status reports
(Project Weekly, Project Monthly, Account, Geo — all sharing the same
Draft/Submitted/Approved/Rejected lifecycle). Once a report is Submitted
(pending review) or Approved (signed off), its owner can no longer change
any of the content filed under it — the report itself, its status-item
grids, and (for Account) RAG Status. Only Draft and Rejected stay editable;
a Rejected report must be revised and resubmitted, which is what makes it
editable again. Mirrors the 409 guard in de_assessment.update_assessment.
"""

from fastapi import HTTPException, status

from app.schemas.enums import ReportStatus

FROZEN_REPORT_STATUSES = (ReportStatus.SUBMITTED, ReportStatus.APPROVED)


def assert_report_editable(report_status: str | ReportStatus | None) -> None:
    if report_status in FROZEN_REPORT_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This report has been submitted and can no longer be edited.",
        )
