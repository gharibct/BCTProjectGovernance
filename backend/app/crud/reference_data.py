from app.crud.base import CRUDBase
from app.models.reference_data import Account, Geo, Organization, Product, ProjectType, Region, ReportingPeriod
from app.schemas.reference_data import (
    AccountCreate,
    AccountUpdate,
    GeoCreate,
    GeoUpdate,
    OrganizationCreate,
    OrganizationUpdate,
    ProductCreate,
    ProductUpdate,
    ProjectTypeCreate,
    ProjectTypeUpdate,
    RegionCreate,
    RegionUpdate,
    ReportingPeriodCreate,
    ReportingPeriodUpdate,
)

organization_crud = CRUDBase[Organization, OrganizationCreate, OrganizationUpdate](Organization)
geo_crud = CRUDBase[Geo, GeoCreate, GeoUpdate](Geo)
region_crud = CRUDBase[Region, RegionCreate, RegionUpdate](Region)
project_type_crud = CRUDBase[ProjectType, ProjectTypeCreate, ProjectTypeUpdate](ProjectType)
product_crud = CRUDBase[Product, ProductCreate, ProductUpdate](Product)
account_crud = CRUDBase[Account, AccountCreate, AccountUpdate](Account)
reporting_period_crud = CRUDBase[ReportingPeriod, ReportingPeriodCreate, ReportingPeriodUpdate](ReportingPeriod)
