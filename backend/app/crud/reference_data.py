from app.crud.base import CRUDBase
from app.models.reference_data import Account, Geo, Organization, ProjectType, ReportingPeriod
from app.schemas.reference_data import (
    AccountCreate,
    AccountUpdate,
    GeoCreate,
    GeoUpdate,
    OrganizationCreate,
    OrganizationUpdate,
    ProjectTypeCreate,
    ProjectTypeUpdate,
    ReportingPeriodCreate,
    ReportingPeriodUpdate,
)

organization_crud = CRUDBase[Organization, OrganizationCreate, OrganizationUpdate](Organization)
geo_crud = CRUDBase[Geo, GeoCreate, GeoUpdate](Geo)
project_type_crud = CRUDBase[ProjectType, ProjectTypeCreate, ProjectTypeUpdate](ProjectType)
account_crud = CRUDBase[Account, AccountCreate, AccountUpdate](Account)
reporting_period_crud = CRUDBase[ReportingPeriod, ReportingPeriodCreate, ReportingPeriodUpdate](ReportingPeriod)
