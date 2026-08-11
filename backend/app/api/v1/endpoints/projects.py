from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, pagination_params
from app.core.db import get_db
from app.crud.projects import project_crud, project_oracle_id_crud, project_resource_crud
from app.models.projects import ProjectOracleId, ProjectResource
from app.schemas.common import Page
from app.schemas.enums import ProjectStatus
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
from app.services.code_generator import generate_code

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=Page[ProjectRead])
async def list_projects(
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    items, total = await project_crud.list(db, skip=pagination.skip, limit=pagination.limit)
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db)):
    code = await generate_code(db, "PROJECT")
    return await project_crud.create(db, payload, project_code=code, project_status=ProjectStatus.DRAFT)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return obj


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(project_id: UUID, payload: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    obj = await project_crud.get(db, project_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return await project_crud.update(db, obj, payload)


# --- Oracle Project ID(s) ---


@router.get("/{project_id}/oracle-ids", response_model=list[ProjectOracleIdRead])
async def list_oracle_ids(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_oracle_id_crud.list(
        db, filters={ProjectOracleId.project_id: project_id}, limit=200
    )
    return items


@router.post("/{project_id}/oracle-ids", response_model=ProjectOracleIdRead, status_code=status.HTTP_201_CREATED)
async def add_oracle_id(project_id: UUID, payload: ProjectOracleIdCreate, db: AsyncSession = Depends(get_db)):
    return await project_oracle_id_crud.create(db, payload, project_id=project_id)


@router.delete("/{project_id}/oracle-ids/{oracle_id_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.post("/{project_id}/resources", response_model=ProjectResourceRead, status_code=status.HTTP_201_CREATED)
async def add_resource(project_id: UUID, payload: ProjectResourceCreate, db: AsyncSession = Depends(get_db)):
    return await project_resource_crud.create(db, payload, project_id=project_id)


@router.put("/{project_id}/resources/{resource_id}", response_model=ProjectResourceRead)
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


@router.delete("/{project_id}/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(project_id: UUID, resource_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await project_resource_crud.get(db, resource_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")
    await project_resource_crud.delete(db, obj)
