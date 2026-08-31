"""DE Project Allocation (design-reference/de-approval) — a DE (or Admin)
assigns not-yet-approved projects to a Delivery Excellence assessor. Assignment
writes Project.delivery_excellence_id + Project.de_allocated_at; there is no
separate allocation entity.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import require_role
from app.core.db import get_db
from app.crud.projects import project_crud
from app.models.projects import Project
from app.models.reference_data import Account
from app.models.users import User
from app.schemas.de_approval import DeAllocationBulkAssign, DeAllocationRow
from app.schemas.enums import ProjectStatus, RoleCode
from app.services.governance_completeness import compute_governance_completeness

router = APIRouter(prefix="/de-allocation", tags=["DE Allocation"])

_de = require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)

# The allocation grid lists projects that are ready for a DE assessor. Draft
# projects are excluded (nothing to allocate yet); Approved projects are
# included so a DE / Admin can re-assign the assessor when it needs to change.
_ALLOCATABLE_STATUSES = (ProjectStatus.PENDING_APPROVAL, ProjectStatus.APPROVED)


async def _user_name(db: AsyncSession, user_id: UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await db.get(User, user_id)
    return user.full_name if user is not None else None


async def _account_name(db: AsyncSession, account_id: UUID | None) -> str | None:
    if account_id is None:
        return None
    account = await db.get(Account, account_id)
    return account.name if account is not None else None


async def _row(
    db: AsyncSession,
    project: Project,
    pm_name: str | None,
    account_name: str | None,
    de_name: str | None,
) -> DeAllocationRow:
    completeness = await compute_governance_completeness(db, project)
    return DeAllocationRow(
        project_id=project.id,
        project_code=project.project_code,
        project_name=project.project_name,
        account_name=account_name,
        project_manager_name=pm_name,
        project_status=project.project_status,
        delivery_excellence_id=project.delivery_excellence_id,
        delivery_excellence_name=de_name,
        de_allocated_at=project.de_allocated_at,
        completion_pct=completeness.completion_pct,
        gaps_count=completeness.gaps_count,
    )


@router.get("", response_model=list[DeAllocationRow], dependencies=[Depends(_de)])
async def list_allocation_grid(db: AsyncSession = Depends(get_db)):
    # Allocation is not period-scoped — the whole allocatable pool is returned.
    pm = aliased(User)
    de = aliased(User)
    stmt = (
        select(Project, pm.full_name, Account.name, de.full_name)
        .outerjoin(pm, pm.id == Project.project_manager_id)
        .outerjoin(Account, Account.id == Project.account_id)
        .outerjoin(de, de.id == Project.delivery_excellence_id)
        .where(Project.project_status.in_(_ALLOCATABLE_STATUSES))
    )
    rows = (await db.execute(stmt)).all()
    return [await _row(db, project, pm_name, acc_name, de_name) for project, pm_name, acc_name, de_name in rows]


@router.patch("/allocations", response_model=list[DeAllocationRow], dependencies=[Depends(_de)])
async def bulk_allocate(payload: DeAllocationBulkAssign, db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    updated: list[Project] = []
    for assignment in payload.assignments:
        project = await project_crud.get(db, assignment.project_id)
        if project is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Project {assignment.project_id} not found")
        if project.project_status not in _ALLOCATABLE_STATUSES:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Project {assignment.project_id} is not in an allocatable status",
            )
        if project.delivery_excellence_id != assignment.delivery_excellence_id:
            project.delivery_excellence_id = assignment.delivery_excellence_id
            project.de_allocated_at = now
        updated.append(project)

    await db.flush()

    result: list[DeAllocationRow] = []
    for project in updated:
        await db.refresh(project)
        result.append(
            await _row(
                db,
                project,
                await _user_name(db, project.project_manager_id),
                await _account_name(db, project.account_id),
                await _user_name(db, project.delivery_excellence_id),
            )
        )
    return result
