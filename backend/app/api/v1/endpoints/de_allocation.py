"""DE Project Allocation (design-reference/de-approval) — a DE (or Admin)
assigns a Delivery Excellence assessor to a non-Draft project, and can
reassign a different one at any time (the list endpoint's `allocation` filter
surfaces already-allocated projects for that). Assignment writes
Project.delivery_excellence_id + Project.de_allocated_at; there is no separate
allocation entity. Allocation is optional — a project can be approved without a
DE (see de_approval.py).
"""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import require_role
from app.core.db import get_db
from app.crud.projects import project_crud
from app.models.projects import Project
from app.models.reference_data import Account, Geo, ProjectType, Region
from app.models.users import User
from app.schemas.de_approval import DeAllocationBulkAssign, DeAllocationRow
from app.schemas.enums import ProjectStatus, RoleCode
from app.services.governance_completeness import compute_governance_completeness

router = APIRouter(prefix="/de-allocation", tags=["DE Allocation"])

_de = require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)


# A project is allocatable once it has left Draft — its status can be anything
# else (Pending Approval, Approved, Under Amendment). Draft projects have nothing
# to allocate yet.
def _is_allocatable(project: Project) -> bool:
    return project.project_status != ProjectStatus.DRAFT


async def _user_name(db: AsyncSession, user_id: UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await db.get(User, user_id)
    return user.full_name if user is not None else None


async def _ref_name(db: AsyncSession, model: type, ref_id: UUID | None) -> str | None:
    """Name of a reference-data row (Account / Geo / Region / ProjectType) by id."""
    if ref_id is None:
        return None
    ref = await db.get(model, ref_id)
    return ref.name if ref is not None else None


async def _row(
    db: AsyncSession,
    project: Project,
    pm_name: str | None,
    account_name: str | None,
    de_name: str | None,
    geo_name: str | None = None,
    region_name: str | None = None,
    project_type_name: str | None = None,
) -> DeAllocationRow:
    completeness = await compute_governance_completeness(db, project)
    return DeAllocationRow(
        project_id=project.id,
        project_code=project.project_code,
        project_name=project.project_name,
        account_name=account_name,
        geo_name=geo_name,
        region_name=region_name,
        project_type_name=project_type_name,
        project_owned=project.project_owned,
        project_manager_name=pm_name,
        project_status=project.project_status,
        lifecycle_status=project.lifecycle_status,
        delivery_excellence_id=project.delivery_excellence_id,
        delivery_excellence_name=de_name,
        de_allocated_at=project.de_allocated_at,
        completion_pct=completeness.completion_pct,
        gaps_count=completeness.gaps_count,
    )


@router.get("", response_model=list[DeAllocationRow], dependencies=[Depends(_de)])
async def list_allocation_grid(
    allocation: Literal["unallocated", "allocated", "all"] = Query(
        "unallocated",
        description=(
            "Which non-Draft projects to return: 'unallocated' (no DE assessor "
            "yet — the default work-to-do list), 'allocated' (already have a DE, "
            "so a DE/Admin can reassign them), or 'all'."
        ),
    ),
    db: AsyncSession = Depends(get_db),
):
    # Allocation is not period-scoped. By default the grid is the work-to-do
    # list (projects with no DE assessor that have left Draft); `allocation`
    # switches it to already-allocated projects for reassignment, or all.
    pm = aliased(User)
    de = aliased(User)
    stmt = (
        select(Project, pm.full_name, Account.name, de.full_name, Geo.name, Region.name, ProjectType.name)
        .outerjoin(pm, pm.id == Project.project_manager_id)
        .outerjoin(Account, Account.id == Project.account_id)
        .outerjoin(de, de.id == Project.delivery_excellence_id)
        .outerjoin(Geo, Geo.id == Project.geo_id)
        .outerjoin(Region, Region.id == Project.region_id)
        .outerjoin(ProjectType, ProjectType.id == Project.project_type_id)
        .where(Project.project_status != ProjectStatus.DRAFT)
    )
    if allocation == "unallocated":
        stmt = stmt.where(Project.delivery_excellence_id.is_(None))
    elif allocation == "allocated":
        stmt = stmt.where(Project.delivery_excellence_id.is_not(None))
    rows = (await db.execute(stmt)).all()
    return [
        await _row(db, project, pm_name, acc_name, de_name, geo_name, region_name, project_type_name)
        for project, pm_name, acc_name, de_name, geo_name, region_name, project_type_name in rows
    ]


@router.patch("/allocations", response_model=list[DeAllocationRow], dependencies=[Depends(_de)])
async def bulk_allocate(payload: DeAllocationBulkAssign, db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    updated: list[Project] = []
    for assignment in payload.assignments:
        project = await project_crud.get(db, assignment.project_id)
        if project is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Project {assignment.project_id} not found")
        if not _is_allocatable(project):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Project {assignment.project_id} is still Draft and cannot be allocated",
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
                await _ref_name(db, Account, project.account_id),
                await _user_name(db, project.delivery_excellence_id),
                await _ref_name(db, Geo, project.geo_id),
                await _ref_name(db, Region, project.region_id),
                await _ref_name(db, ProjectType, project.project_type_id),
            )
        )
    return result
