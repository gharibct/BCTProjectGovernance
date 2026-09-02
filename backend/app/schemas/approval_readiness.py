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

from app.schemas.enums import ProjectStatus


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


class ApprovalReadiness(BaseModel):
    completion_pct: int
    modules_complete: int
    modules_incomplete: int
    gaps_count: int
    critical_gaps: int
    modules: list[ApprovalReadinessModule]
    project_status: ProjectStatus
    can_submit: bool
