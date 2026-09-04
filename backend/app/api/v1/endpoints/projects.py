from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    PaginationParams,
    get_current_user,
    pagination_params,
    require_project_access,
    require_role,
)
from app.core.db import get_db
from app.crud.projects import project_crud, project_oracle_id_crud, project_resource_crud
from app.models.projects import Project, ProjectOracleId, ProjectResource
from app.models.users import User
from app.schemas.approval_readiness import ApprovalReadiness
from app.schemas.common import Page
from app.schemas.enums import ProjectLifecycleStatus, ProjectStatus, RoleCode
from app.schemas.projects import (
    ProjectCreate,
    ProjectOracleIdCreate,
    ProjectOracleIdRead,
    ProjectRead,
    ProjectResourceCreate,
    ProjectResourceRead,
    ProjectResourceSummary,
    ProjectResourceUpdate,
    ProjectUpdate,
)
from app.services.amendment import active_amendment, initiate_amendment
from app.services.approval_readiness import compute_approval_readiness
from app.services.code_generator import generate_code

def _is_amendable(obj: Project) -> bool:
    """An approved project can be amended unless its lifecycle state is Closed."""
    return (
        obj.project_status == ProjectStatus.APPROVED
        and obj.lifecycle_status != ProjectLifecycleStatus.CLOSED
    )

router = APIRouter(prefix="/projects", tags=["Projects"])

# Project creation/maintenance is the Project Manager's flow. Via the top-bar
# Work Context an Account/Geo Head can also do PM work — but only on projects in
# their own accounts/geo, which require_project_access enforces off {project_id}.
# Create has no project_id yet, so it stays a role-only gate.
_pm_create = [Depends(require_role(RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]
_pm_write = [
    Depends(
        require_project_access(
            RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN
        )
    )
]


@router.get("", response_model=Page[ProjectRead])
async def list_projects(
    exclude_status: list[ProjectStatus] | None = Query(None),
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    if not exclude_status:
        items, total = await project_crud.list(
            db, skip=pagination.skip, limit=pagination.limit, order_by=Project.updated_at.desc()
        )
        return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)

    # e.g. ?exclude_status=Draft — the DE "Projects" browser hides Draft projects.
    vals = [s.value for s in exclude_status]
    where = Project.project_status.notin_(vals)
    total = (
        await db.execute(select(func.count()).select_from(Project).where(where))
    ).scalar_one()
    items = (
        await db.execute(
            select(Project)
            .where(where)
            .order_by(Project.updated_at.desc())
            .offset(pagination.skip)
            .limit(pagination.limit)
        )
    ).scalars().all()
    return Page(items=list(items), total=total, skip=pagination.skip, limit=pagination.limit)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED, dependencies=_pm_create)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db)):
    code = await generate_code(db, "PROJECT")
    return await project_crud.create(db, payload, project_code=code, project_status=ProjectStatus.DRAFT)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return obj


@router.put("/{project_id}", response_model=ProjectRead, dependencies=_pm_write)
async def update_project(project_id: UUID, payload: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return await project_crud.update(db, obj, payload)


# --- Send To Approval (Maintain Project) + Amend Approved Project ---


@router.get("/{project_id}/approval-readiness", response_model=ApprovalReadiness, dependencies=_pm_write)
async def get_approval_readiness(project_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return await compute_approval_readiness(db, obj)


@router.post("/{project_id}/initiate-amendment", response_model=ProjectRead, dependencies=_pm_write)
async def initiate_project_amendment(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start amending an already-approved project: snapshot the current project
    data into the amendment audit store and move the project to Under Amendment.
    """
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if not _is_amendable(obj):
        effective = obj.lifecycle_status or obj.project_status
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Only an approved project that isn't Closed can be amended "
                f"(this one is {effective})."
            ),
        )
    if await active_amendment(db, project_id) is not None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="An amendment is already in progress for this project.",
        )

    await initiate_amendment(db, obj, current_user.id)
    await db.refresh(obj)
    return obj


@router.post("/{project_id}/send-to-approval", response_model=ProjectRead, dependencies=_pm_write)
async def send_to_approval(project_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    readiness = await compute_approval_readiness(db, obj)
    if obj.project_status not in (ProjectStatus.DRAFT, ProjectStatus.UNDER_AMENDMENT):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": f"Project is {obj.project_status}; only a Draft or Under Amendment project can be submitted.",
                "readiness": readiness.model_dump(mode="json"),
            },
        )
    incomplete = [m.label for m in readiness.modules if m.mandatory and not m.complete]
    if incomplete:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Complete all mandatory modules first: " + ", ".join(incomplete),
                "readiness": readiness.model_dump(mode="json"),
            },
        )

    from_amendment = obj.project_status == ProjectStatus.UNDER_AMENDMENT
    obj.project_status = ProjectStatus.PENDING_APPROVAL
    if from_amendment:
        amendment = await active_amendment(db, project_id)
        if amendment is not None:
            amendment.status = "Submitted"
            amendment.submitted_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.post("/{project_id}/recall-approval", response_model=ProjectRead, dependencies=_pm_write)
async def recall_approval(project_id: UUID, db: AsyncSession = Depends(get_db)):
    """PM pulls a project back from the DE approval queue so it can be edited
    again. Only valid while it is still Pending Approval (no decision taken).
    Lands back in Under Amendment when it came from an amendment, else Draft."""
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if obj.project_status != ProjectStatus.PENDING_APPROVAL:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only a project Pending Approval can be recalled (this one is {obj.project_status}).",
        )

    amendment = await active_amendment(db, project_id)
    if amendment is not None:
        obj.project_status = ProjectStatus.UNDER_AMENDMENT
        amendment.status = "In Progress"
        amendment.submitted_at = None
    else:
        obj.project_status = ProjectStatus.DRAFT
    obj.de_review_status = None
    await db.flush()
    await db.refresh(obj)
    return obj


# --- Oracle Project ID(s) ---


@router.get("/{project_id}/oracle-ids", response_model=list[ProjectOracleIdRead])
async def list_oracle_ids(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_oracle_id_crud.list(
        db, filters={ProjectOracleId.project_id: project_id}, limit=200
    )
    return items


@router.post(
    "/{project_id}/oracle-ids",
    response_model=ProjectOracleIdRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pm_write,
)
async def add_oracle_id(project_id: UUID, payload: ProjectOracleIdCreate, db: AsyncSession = Depends(get_db)):
    return await project_oracle_id_crud.create(db, payload, project_id=project_id)


@router.delete("/{project_id}/oracle-ids/{oracle_id_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_oracle_id(project_id: UUID, oracle_id_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_oracle_id_crud.get(db, oracle_id_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Oracle ID mapping not found")
    await project_oracle_id_crud.delete(db, obj)


# --- Resource Allocation ---


@router.get("/{project_id}/resources/summary", response_model=ProjectResourceSummary)
async def resource_summary(project_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(
        func.count(ProjectResource.id),
        func.coalesce(func.sum(ProjectResource.fte_allocation), 0),
    ).where(ProjectResource.project_id == project_id)
    head_count, total_fte = (await db.execute(stmt)).one()
    return ProjectResourceSummary(head_count=head_count, total_fte=total_fte)


@router.get("/{project_id}/resources", response_model=list[ProjectResourceRead])
async def list_resources(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_resource_crud.list(
        db, filters={ProjectResource.project_id: project_id}, limit=500
    )
    return items


@router.post(
    "/{project_id}/resources",
    response_model=ProjectResourceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=_pm_write,
)
async def add_resource(project_id: UUID, payload: ProjectResourceCreate, db: AsyncSession = Depends(get_db)):
    return await project_resource_crud.create(db, payload, project_id=project_id)


@router.put("/{project_id}/resources/{resource_id}", response_model=ProjectResourceRead, dependencies=_pm_write)
async def update_resource(
    project_id: UUID,
    resource_id: UUID,
    payload: ProjectResourceUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await project_resource_crud.get(db, resource_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")
    return await project_resource_crud.update(db, obj, payload)


@router.delete("/{project_id}/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_resource(project_id: UUID, resource_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_resource_crud.get(db, resource_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")
    await project_resource_crud.delete(db, obj)
