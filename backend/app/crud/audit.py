from app.crud.base import CRUDBase
from app.models.audit import UserActivityLog

user_activity_log_crud = CRUDBase(UserActivityLog)  # read-only via the API; written internally by services
