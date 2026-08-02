from app.crud.base import CRUDBase
from app.models.projects import Project, ProjectOracleId, ProjectResource
from app.schemas.projects import (
    ProjectCreate,
    ProjectOracleIdCreate,
    ProjectResourceCreate,
    ProjectResourceUpdate,
    ProjectUpdate,
)

project_crud = CRUDBase[Project, ProjectCreate, ProjectUpdate](Project)
project_oracle_id_crud = CRUDBase[ProjectOracleId, ProjectOracleIdCreate, ProjectOracleIdCreate](ProjectOracleId)
project_resource_crud = CRUDBase[ProjectResource, ProjectResourceCreate, ProjectResourceUpdate](ProjectResource)
