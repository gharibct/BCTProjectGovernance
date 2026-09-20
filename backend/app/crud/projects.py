from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.projects import Project, ProjectOracleId, ProjectResource
from app.services.exchange_rates import sync_project_revenue_usd
from app.schemas.projects import (
    ProjectCreate,
    ProjectOracleIdCreate,
    ProjectResourceCreate,
    ProjectResourceUpdate,
    ProjectUpdate,
)



class ProjectCRUD(CRUDBase[Project, ProjectCreate, ProjectUpdate]):
    """Keeps projects.project_revenue_usd in step with revenue/currency on every write."""

    async def create(self, db: AsyncSession, obj_in: ProjectCreate, **extra: Any) -> Project:
        obj = await super().create(db, obj_in, **extra)
        await sync_project_revenue_usd(db, obj)
        return obj

    async def update(self, db: AsyncSession, db_obj: Project, obj_in: ProjectUpdate) -> Project:
        obj = await super().update(db, db_obj, obj_in)
        await sync_project_revenue_usd(db, obj)
        return obj


project_crud = ProjectCRUD(Project)
project_oracle_id_crud = CRUDBase[ProjectOracleId, ProjectOracleIdCreate, ProjectOracleIdCreate](ProjectOracleId)
project_resource_crud = CRUDBase[ProjectResource, ProjectResourceCreate, ProjectResourceUpdate](ProjectResource)
