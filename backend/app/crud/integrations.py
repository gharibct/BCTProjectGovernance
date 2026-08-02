from app.crud.base import CRUDBase
from app.models.integrations import BackupRestoreLog, IntegrationConnection
from app.schemas.integrations import IntegrationConnectionCreate, IntegrationConnectionUpdate

integration_connection_crud = CRUDBase[IntegrationConnection, IntegrationConnectionCreate, IntegrationConnectionUpdate](
    IntegrationConnection
)
backup_restore_log_crud = CRUDBase(BackupRestoreLog)
