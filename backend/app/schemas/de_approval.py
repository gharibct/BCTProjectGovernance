"""Schemas for DE Project Allocation + DE Project Approval
(design-reference/de-approval). Allocation assigns Project.delivery_excellence_id;
approval runs a project_status Pending Approval -> Approved / Draft transition
plus a de_review_status sub-state and a per-module review checklist."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.enums import (
    DeModuleReviewAction,
    DeReviewStatus,
    GovernanceModuleKey,
    ProjectLifecycleStatus,
    ProjectStatus,
)

# --- Governance completeness -------------------------------------------------


class GovernanceModuleStatus(BaseModel):
    key: GovernanceModuleKey
    label: str
    mandatory: bool
    complete: bool
    gaps: str | None = None
    review_action: DeModuleReviewAction = DeModuleReviewAction.NOT_REVIEWED
    last_updated: datetime | None = None
    # Partial progress: required fields filled / required fields expected.
    fields_complete: int = 0
    fields_total: int = 0
    progress_pct: int = 0


class GovernanceCompleteness(BaseModel):
    completion_pct: int
    modules_complete: int
    modules_incomplete: int
    gaps_count: int
    critical_gaps: int
    modules: list[GovernanceModuleStatus]


# --- DE Project Allocation -------------------------------------------------


class DeAllocationRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    account_name: str | None = None
    project_manager_name: str | None = None
    project_status: ProjectStatus
    lifecycle_status: ProjectLifecycleStatus | None = None
    delivery_excellence_id: UUID | None = None
    delivery_excellence_name: str | None = None
    de_allocated_at: datetime | None = None
    completion_pct: int
    gaps_count: int


class DeAllocationAssignment(BaseModel):
    project_id: UUID
    delivery_excellence_id: UUID


class DeAllocationBulkAssign(BaseModel):
    assignments: list[DeAllocationAssignment] = Field(min_length=1)


# --- DE Project Approval queue -------------------------------------------------


class DeApprovalKpis(BaseModel):
    awaiting_review: int
    in_review: int
    returned: int


class DeApprovalQueueRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    account_name: str | None = None
    geo_name: str | None = None
    region_name: str | None = None
    project_type_name: str | None = None
    project_manager_name: str | None = None
    completion_pct: int
    gaps_count: int
    project_status: ProjectStatus
    lifecycle_status: ProjectLifecycleStatus | None = None
    de_review_status: DeReviewStatus | None = None
    last_updated: datetime
    href: str


class DeApprovalQueueResponse(BaseModel):
    period_id: UUID | None = None
    kpis: DeApprovalKpis
    rows: list[DeApprovalQueueRow]


# --- Project Governance Review workspace -------------------------------------------------


class DeReviewDetail(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    account_name: str | None = None
    project_manager_name: str | None = None
    project_status: ProjectStatus
    lifecycle_status: ProjectLifecycleStatus | None = None
    de_review_status: DeReviewStatus | None = None
    de_review_remarks: str | None = None
    de_reviewed_by: UUID | None = None
    de_reviewed_at: datetime | None = None
    completeness: GovernanceCompleteness


class DeModuleReviewUpdate(BaseModel):
    review_action: DeModuleReviewAction
    remarks: str | None = None


class DeReviewDecisionRequest(BaseModel):
    decision: Literal["Approve", "Return"]
    remarks: str = Field(min_length=1)  # DE Review Remarks — mandatory
    reviewed_by: UUID
