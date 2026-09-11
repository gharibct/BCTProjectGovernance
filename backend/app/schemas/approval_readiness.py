"""PM-facing "Send To Approval" readiness for the Maintain Project screen.

Parallel to de_approval.GovernanceCompleteness, but scoped to what the Project
Manager must complete before a Draft project can be submitted for DE approval:
Project Profile, Scope & Schedule, Measurement targets, Commitments and
Milestones are all mandatory; the RAIDO register is informational and never
blocks submission. Deliberately NOT reusing GovernanceModuleKey — that enum is
tied to the DE review baseline (Map Oracle Projects, per-module review_action).
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.enums import (
    DeModuleReviewAction,
    DeReviewStatus,
    ProjectLifecycleStatus,
    ProjectStatus,
)


class ApprovalReadinessModule(BaseModel):
    key: str
    label: str
    mandatory: bool
    complete: bool
    gaps: str | None = None
    last_updated: datetime | None = None
    # Partial progress: required fields filled / required fields expected.
    # For the >=1-row modules (commitments, milestones) this is 0/1 or 1/1.
    fields_complete: int = 0
    fields_total: int = 0
    progress_pct: int = 0
    # The DE's per-section verdict from the last Project Details Approval review
    # ("Not Reviewed" until the DE picks one). Commitments and Milestones both
    # mirror the single Contractual Compliance module the DE reviews.
    de_review_action: DeModuleReviewAction = DeModuleReviewAction.NOT_REVIEWED
    de_review_remarks: str | None = None


class ApprovalReadiness(BaseModel):
    completion_pct: int
    modules_complete: int
    modules_incomplete: int
    gaps_count: int
    critical_gaps: int
    modules: list[ApprovalReadinessModule]
    project_status: ProjectStatus
    lifecycle_status: ProjectLifecycleStatus | None = None
    can_submit: bool
    # Last DE governance-review outcome, surfaced to the PM. de_review_remarks
    # is the mandatory remark the DE entered when approving / returning.
    de_review_status: DeReviewStatus | None = None
    de_review_remarks: str | None = None
    de_reviewed_at: datetime | None = None
