from app.crud.base import CRUDBase
from app.models.data_integrity import DataIntegrityChecklistItem
from app.schemas.data_integrity import DataIntegrityChecklistItemCreate, DataIntegrityChecklistItemUpdate

data_integrity_checklist_item_crud = CRUDBase[
    DataIntegrityChecklistItem, DataIntegrityChecklistItemCreate, DataIntegrityChecklistItemUpdate
](DataIntegrityChecklistItem)
