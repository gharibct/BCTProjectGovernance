"""Amend Approved Project — snapshot the current project data into an audit
store and move the project into "Under Amendment".

On Initiate Amendment every project-scoped row (the projects row plus every
module table) is serialized to JSON and stored in project_amendment_snapshots,
grouped by a project_amendments row. That control row is also what tells Recall
and the DE "Return" decision to route the project back to "Under Amendment"
rather than "Draft".
"""

import json
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.amendment import ProjectAmendment, ProjectAmendmentSnapshot
from app.models.contractual import ContractualCommitment, MilestonePayment
from app.models.metric_target import (
    MetricTargetCloudMaintenance,
    MetricTargetCloudMigration,
    MetricTargetConsulting,
    MetricTargetDevelopment,
    MetricTargetStaffing,
    MetricTargetStaffingPriority,
    MetricTargetSupport,
    MetricTargetTesting,
)
from app.models.projects import Project, ProjectOracleId, ProjectResource
from app.models.raid import (
    AssumptionLog,
    DependencyLog,
    IssueLog,
    OpportunityLog,
    RiskLog,
)
from app.schemas.enums import ProjectStatus

# project_id-keyed tables captured verbatim on Initiate Amendment. The projects
# row and the staffing-priority child table are handled separately below.
_PROJECT_ID_MODELS: list[type] = [
    ProjectOracleId,
    ProjectResource,
    ContractualCommitment,
    MilestonePayment,
    MetricTargetDevelopment,
    MetricTargetSupport,
    MetricTargetStaffing,
    MetricTargetTesting,
    MetricTargetConsulting,
    MetricTargetCloudMaintenance,
    MetricTargetCloudMigration,
    RiskLog,
    IssueLog,
    DependencyLog,
    AssumptionLog,
    OpportunityLog,
]

_ACTIVE_STATUSES = ("In Progress", "Submitted")


def _jsonable(row: object) -> dict:
    data = {c.name: getattr(row, c.name) for c in type(row).__table__.columns}
    return json.loads(json.dumps(data, default=str))


def _snapshot(amendment: ProjectAmendment, project_id: UUID, table: str, row: object, now: datetime):
    return ProjectAmendmentSnapshot(
        id=uuid4(),
        amendment_id=amendment.id,
        project_id=project_id,
        source_table=table,
        source_row_id=getattr(row, "id", None),
        row_data=_jsonable(row),
        created_at=now,
    )


async def active_amendment(db: AsyncSession, project_id: UUID) -> ProjectAmendment | None:
    stmt = (
        select(ProjectAmendment)
        .where(ProjectAmendment.project_id == project_id, ProjectAmendment.status.in_(_ACTIVE_STATUSES))
        .order_by(ProjectAmendment.initiated_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return rows[0] if rows else None


async def initiate_amendment(db: AsyncSession, project: Project, actor_id: UUID | None) -> ProjectAmendment:
    now = datetime.now(UTC)
    amendment = ProjectAmendment(
        id=uuid4(),
        project_id=project.id,
        status="In Progress",
        initiated_by=actor_id,
        initiated_at=now,
        submitted_at=None,
        completed_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(amendment)
    await db.flush()

    # The projects row itself (Project Profile + Scope & Schedule fields).
    db.add(_snapshot(amendment, project.id, "projects", project, now))

    for model in _PROJECT_ID_MODELS:
        rows = (
            await db.execute(select(model).where(model.project_id == project.id))
        ).scalars().all()
        for row in rows:
            db.add(_snapshot(amendment, project.id, model.__tablename__, row, now))

    # Staffing priority targets are keyed off metric_target_staffing.id, not project_id.
    staffing_ids = (
        await db.execute(
            select(MetricTargetStaffing.id).where(MetricTargetStaffing.project_id == project.id)
        )
    ).scalars().all()
    if staffing_ids:
        priority_rows = (
            await db.execute(
                select(MetricTargetStaffingPriority).where(
                    MetricTargetStaffingPriority.metric_target_id.in_(staffing_ids)
                )
            )
        ).scalars().all()
        for row in priority_rows:
            db.add(
                _snapshot(
                    amendment, project.id, MetricTargetStaffingPriority.__tablename__, row, now
                )
            )

    project.project_status = ProjectStatus.UNDER_AMENDMENT
    project.de_review_status = None
    project.de_review_remarks = None
    project.de_reviewed_by = None
    project.de_reviewed_at = None

    await db.flush()
    return amendment
