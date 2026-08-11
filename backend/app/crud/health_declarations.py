from app.crud.base import CRUDBase
from app.models.health_declarations import HealthDeclaration
from app.schemas.health_declarations import HealthDeclarationCreate, HealthDeclarationUpdate

health_declaration_crud = CRUDBase[HealthDeclaration, HealthDeclarationCreate, HealthDeclarationUpdate](
    HealthDeclaration
)
