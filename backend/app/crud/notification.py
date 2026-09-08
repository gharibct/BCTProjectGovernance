from app.crud.base import CRUDBase
from app.models.notification import Notification

# Read-only via the API (list / get). Rows are written by
# app.services.notifications.notify(); read_at is set by the endpoint directly.
notification_crud = CRUDBase(Notification)
