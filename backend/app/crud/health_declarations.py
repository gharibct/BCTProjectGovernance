from app.crud.base import CRUDBase
from app.models.health_declarations import HealthDeclaration, ProjectHealthItem
from app.schemas.health_declarations import (
    HealthDeclarationCreate,
    HealthDeclarationUpdate,
    ProjectHealthItemCreate,
    ProjectHealthItemUpdate,
)

health_declaration_crud = CRUDBase[HealthDeclaration, HealthDeclarationCreate, HealthDeclarationUpdate](
    HealthDeclaration
)
project_health_item_crud = CRUDBase[ProjectHealthItem, ProjectHealthItemCreate, ProjectHealthItemUpdate](
    ProjectHealthItem
)
