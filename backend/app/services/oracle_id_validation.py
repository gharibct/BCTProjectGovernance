"""Which Oracle Project IDs a new project may claim (Create Project screen).

An Oracle Project ID is usable only when
* it exists in `oracle_project_master`, and
* no governance project already carries it in `project_oracle_ids` - whatever
  that project's status (Draft, Pending Approval, Approved, Under Amendment,
  Closed, ...): one Oracle project maps to exactly one governance project, and
* (when a new request is being submitted) no other Pending creation request is
  already asking for it. Rejected requests never created a project, so they
  don't hold the ID.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oracle_man_month import OracleProjectMaster
from app.models.project_creation_request import ProjectCreationRequest, ProjectCreationRequestOracleId
from app.models.projects import Project, ProjectOracleId

PENDING = "Pending"


async def oracle_id_blockers(
    db: AsyncSession,
    oracle_project_ids: list[str],
    *,
    exclude_request_id: UUID | None = None,
    check_pending_requests: bool = True,
) -> dict[str, str]:
    """Oracle Project ID -> why it can't be used. IDs that are fine are absent."""
    ids = list(dict.fromkeys(oracle_project_ids))
    if not ids:
        return {}

    known = set(
        (await db.execute(select(OracleProjectMaster.project_number).where(OracleProjectMaster.project_number.in_(ids))))
        .scalars()
        .all()
    )
    mapped = {
        oracle_id: (code, name, status)
        for oracle_id, code, name, status in (
            await db.execute(
                select(
                    ProjectOracleId.oracle_project_id,
                    Project.project_code,
                    Project.project_name,
                    Project.project_status,
                )
                .join(Project, Project.id == ProjectOracleId.project_id)
                .where(ProjectOracleId.oracle_project_id.in_(ids))
            )
        ).all()
    }
    pending: dict[str, str] = {}
    if check_pending_requests:
        stmt = (
            select(ProjectCreationRequestOracleId.oracle_project_id, ProjectCreationRequest.project_name)
            .join(
                ProjectCreationRequest,
                ProjectCreationRequest.id == ProjectCreationRequestOracleId.request_id,
            )
            .where(
                ProjectCreationRequestOracleId.oracle_project_id.in_(ids),
                ProjectCreationRequest.status == PENDING,
            )
        )
        if exclude_request_id is not None:
            stmt = stmt.where(ProjectCreationRequest.id != exclude_request_id)
        pending = dict((await db.execute(stmt)).all())

    blockers: dict[str, str] = {}
    for oracle_id in ids:
        if oracle_id not in known:
            blockers[oracle_id] = f"Oracle Project ID {oracle_id} was not found in the Oracle project master."
        elif oracle_id in mapped:
            code, name, status = mapped[oracle_id]
            blockers[oracle_id] = (
                f"Oracle Project ID {oracle_id} is already mapped to project {code} - {name} ({status})."
            )
        elif oracle_id in pending:
            blockers[oracle_id] = (
                f'Oracle Project ID {oracle_id} is already on a pending creation request for "{pending[oracle_id]}".'
            )
    return blockers
