from app.crud.base import CRUDBase
from app.models.regional_status import AccountStatusItem, AccountStatusReport, GeoStatusItem, GeoStatusReport
from app.schemas.regional_status import (
    AccountStatusItemCreate,
    AccountStatusItemUpdate,
    AccountStatusReportCreate,
    AccountStatusReportUpdate,
    GeoStatusItemCreate,
    GeoStatusItemUpdate,
    GeoStatusReportCreate,
    GeoStatusReportUpdate,
)

account_status_report_crud = CRUDBase[AccountStatusReport, AccountStatusReportCreate, AccountStatusReportUpdate](
    AccountStatusReport
)
geo_status_report_crud = CRUDBase[GeoStatusReport, GeoStatusReportCreate, GeoStatusReportUpdate](GeoStatusReport)
account_status_item_crud = CRUDBase[AccountStatusItem, AccountStatusItemCreate, AccountStatusItemUpdate](
    AccountStatusItem
)
geo_status_item_crud = CRUDBase[GeoStatusItem, GeoStatusItemCreate, GeoStatusItemUpdate](GeoStatusItem)
