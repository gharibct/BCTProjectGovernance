from app.crud.base import CRUDBase
from app.models.actions import Action, ActionHistory
from app.schemas.actions import ActionCreate, ActionHistoryCreate, ActionUpdate

action_crud = CRUDBase[Action, ActionCreate, ActionUpdate](Action)

# Append-only — only .create() is ever called (no edit/delete for a history row).
action_history_crud = CRUDBase[ActionHistory, ActionHistoryCreate, ActionHistoryCreate](ActionHistory)
