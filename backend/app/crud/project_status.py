from app.crud.base import CRUDBase
from app.models.project_status import ProjectStatusReport
from app.schemas.project_status import ProjectStatusReportCreate, ProjectStatusReportUpdate

project_status_report_crud = CRUDBase[ProjectStatusReport, ProjectStatusReportCreate, ProjectStatusReportUpdate](
    ProjectStatusReport
)
