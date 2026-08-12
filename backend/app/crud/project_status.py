from app.crud.base import CRUDBase
from app.models.project_status import ProjectStatusItem, ProjectStatusReport
from app.schemas.project_status import (
    ProjectStatusItemCreate,
    ProjectStatusItemUpdate,
    ProjectStatusReportCreate,
    ProjectStatusReportUpdate,
)

project_status_report_crud = CRUDBase[ProjectStatusReport, ProjectStatusReportCreate, ProjectStatusReportUpdate](
    ProjectStatusReport
)
project_status_item_crud = CRUDBase[ProjectStatusItem, ProjectStatusItemCreate, ProjectStatusItemUpdate](
    ProjectStatusItem
)
