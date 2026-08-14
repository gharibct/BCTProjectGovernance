from app.crud.base import CRUDBase
from app.models.account_health_declarations import AccountHealthDeclaration, AccountHealthItem
from app.schemas.account_health_declarations import (
    AccountHealthDeclarationCreate,
    AccountHealthDeclarationUpdate,
    AccountHealthItemCreate,
    AccountHealthItemUpdate,
)

account_health_declaration_crud = CRUDBase[
    AccountHealthDeclaration, AccountHealthDeclarationCreate, AccountHealthDeclarationUpdate
](AccountHealthDeclaration)
account_health_item_crud = CRUDBase[AccountHealthItem, AccountHealthItemCreate, AccountHealthItemUpdate](
    AccountHealthItem
)
