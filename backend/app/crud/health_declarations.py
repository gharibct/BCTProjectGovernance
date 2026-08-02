from app.crud.base import CRUDBase
from app.models.health_declarations import HealthDeclaration
from app.schemas.health_declarations import HealthDeclarationCreate

# Append-only history — no update schema; declarations are never edited after creation.
health_declaration_crud = CRUDBase[HealthDeclaration, HealthDeclarationCreate, HealthDeclarationCreate](
    HealthDeclaration
)
