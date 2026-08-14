from app.crud.base import CRUDBase
from app.models.executive_updates import ExecutiveUpdate
from app.schemas.executive_updates import ExecutiveUpdateCreate, ExecutiveUpdateUpdate

executive_update_crud = CRUDBase[ExecutiveUpdate, ExecutiveUpdateCreate, ExecutiveUpdateUpdate](ExecutiveUpdate)
