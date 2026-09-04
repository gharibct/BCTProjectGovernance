"""PM Findings API — the Project Manager's view of findings raised on their own
projects (`project.project_manager_id == caller`; ADMIN sees all). Reads reuse
the DE Findings list/KPI service (`services/de_findings.py`) with a
`project_manager_id` scope. The only write a PM can do is "Action Taken":
record remarks and move the finding to "Awaiting Closure".
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    PaginationParams,
    _role_code,
    get_current_user,
    pagination_params,
    require_pm_findings_write,
    require_role,
)
from app.core.db import get_db
from app.crud.de_assessment import de_assessment_finding_crud
from app.crud.projects import project_crud
from app.models.users import User
from app.schemas.common import Page
from app.schemas.de_assessment import DEAssessmentFindingRead
from app.schemas.de_findings import DEFindingListRow, DEFindingsKpis, PmFindingActionTaken
from app.schemas.enums import FindingStatus, RoleCode
from app.services.de_findings import DEFindingFilters, de_findings_kpis, list_de_findings

router = APIRouter(prefix="/pm-findings", tags=["PM Findings"])

_read_gate = [Depends(require_role(RoleCode.PROJECT_MANAGER, RoleCode.ADMIN))]

_ACTIONABLE_STATUSES = (FindingStatus.OPEN.value, FindingStatus.IN_PROGRESS.value)


async def _pm_scope(current_user: User, db: AsyncSession) -> UUID | None:
    """current_user.id for a real PM (scopes the list to their own projects),
    None for ADMIN (sees every project's findings)."""
    role_code = await _role_code(db, current_user)
    return None if role_code == RoleCode.ADMIN else current_user.id


@router.get("", response_model=Page[DEFindingListRow], dependencies=_read_gate)
async def list_findings(
    project_id: UUID | None = None,
    status: str | None = "Active",
    bucket: str | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = DEFindingFilters(
        project_id=project_id,
        project_manager_id=await _pm_scope(current_user, db),
        status=status,
        bucket=bucket,
    )
    items, total = await list_de_findings(db, filters, pagination.skip, pagination.limit)
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/kpis", response_model=DEFindingsKpis, dependencies=_read_gate)
async def findings_kpis(
    project_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = DEFindingFilters(
        project_id=project_id,
        project_manager_id=await _pm_scope(current_user, db),
    )
    return await de_findings_kpis(db, filters)


@router.put("/{finding_id}/action-taken", response_model=DEAssessmentFindingRead)
async def action_taken(
    finding_id: UUID,
    payload: PmFindingActionTaken,
    ctx=Depends(require_pm_findings_write),
    db: AsyncSession = Depends(get_db),
):
    obj = await de_assessment_finding_crud.get(db, finding_id)
    if obj is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Finding not found")

    project = await project_crud.get(db, obj.project_id)
    if ctx.role != RoleCode.ADMIN and (project is None or project.project_manager_id != ctx.user.id):
        raise HTTPException(http_status.HTTP_403_FORBIDDEN, "Not the manager of this project")

    if obj.status not in _ACTIONABLE_STATUSES:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT, f"Finding is {obj.status}, not open for action"
        )

    obj.remarks = payload.remarks
    obj.status = FindingStatus.AWAITING_CLOSURE.value
    await db.flush()
    return obj
