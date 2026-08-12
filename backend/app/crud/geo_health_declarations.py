from app.crud.base import CRUDBase
from app.models.geo_health_declarations import GeoHealthDeclaration
from app.schemas.geo_health_declarations import GeoHealthDeclarationCreate, GeoHealthDeclarationUpdate

geo_health_declaration_crud = CRUDBase[GeoHealthDeclaration, GeoHealthDeclarationCreate, GeoHealthDeclarationUpdate](
    GeoHealthDeclaration
)
