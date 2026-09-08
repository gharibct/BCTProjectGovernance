"""Schemas for the portfolio-wide DE Findings screen (a cross-project view over
the project-level `de_assessment_findings` register). The project-scoped
create/update/read shapes live in `app.schemas.de_assessment` and are reused
here — this module only adds the enriched list row, the KPI summary, and the
body-carries-project create payload."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.de_assessment import DEAssessmentFindingIn
from app.schemas.enums import DEFindingHistoryEventType, FindingClassification, FindingStatus


class DEFindingListRow(BaseModel):
    """One findings-grid row: the finding plus the project/account/geo/assignee
    labels the grid shows, built manually in the service (same style as
    dashboard.FindingRow)."""

    id: UUID
    project_id: UUID
    sequence_no: int
    category: str
    classification: FindingClassification
    description: str | None = None
    assigned_to: UUID | None = None
    action_taken: str | None = None
    action_taken_date: date | None = None
    finding_date: date | None = None
    due_date: date | None = None
    status: FindingStatus
    remarks: str | None = None
    closure_date: date | None = None
    created_at: datetime
    updated_at: datetime

    project_label: str
    project_code: str | None = None
    project_name: str | None = None
    account_name: str | None = None
    geo_name: str | None = None
    region_name: str | None = None
    assignee_name: str | None = None
    age_days: int | None = None
    overdue: bool = False


class DEFindingsKpis(BaseModel):
    """The KPI tiles plus the "Attention Required" chip counts, all computed
    over the Geo/Account/Project scope only (see de_findings.compute_kpis)."""

    open_findings: int
    overdue: int
    awaiting_closure: int
    closed_this_period: int
    overdue_30d_count: int
    awaiting_closure_count: int
    projects_over_5_open_count: int
    period_label: str | None = None


class DEFindingCreate(DEAssessmentFindingIn):
    """Create payload for POST /de-findings — the project is chosen in the
    drawer, so it rides in the body (the project-scoped route takes it from the
    path). `sequence_no` is inherited but ignored (assigned server-side).

    finding_date/due_date are mandatory here (unlike the DE Assessment
    Workspace's project-scoped create, which still allows them optional) —
    the /de-findings screen requires both up front."""

    project_id: UUID
    finding_date: date
    due_date: date


class DEFindingHistoryCreate(BaseModel):
    """Internal — written by the finding write paths, never accepted from a
    client. `created_at` is filled by CRUDBase.create."""

    finding_id: UUID
    event_type: DEFindingHistoryEventType
    comment: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_by: UUID


class DEFindingHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    finding_id: UUID
    event_type: DEFindingHistoryEventType
    comment: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_by: UUID
    created_at: datetime


class PmFindingActionTaken(BaseModel):
    """Body for PUT /pm-findings/{id}/action-taken — the PM records what was
    done (mandatory) and the date it was done (defaults to today server-side),
    and the finding moves to "Awaiting Closure"."""

    action_taken: str = Field(min_length=1)
    action_taken_date: date | None = None
