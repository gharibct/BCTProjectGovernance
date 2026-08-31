from fastapi import APIRouter, Depends

from app.api.deps import require_role
from app.api.v1.factory import build_crud_router
from app.crud.reference_data import (
    account_crud,
    geo_crud,
    organization_crud,
    product_crud,
    project_type_crud,
    region_crud,
    reporting_period_crud,
)
from app.schemas.enums import RoleCode
from app.schemas.reference_data import (
    AccountCreate,
    AccountRead,
    AccountUpdate,
    GeoCreate,
    GeoRead,
    GeoUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProjectTypeCreate,
    ProjectTypeRead,
    ProjectTypeUpdate,
    RegionCreate,
    RegionRead,
    RegionUpdate,
    ReportingPeriodCreate,
    ReportingPeriodRead,
    ReportingPeriodUpdate,
)

router = APIRouter()

# Foundational master data (orgs/geos/accounts/project types/reporting
# periods) — only ADMIN creates/edits these; every authenticated role still
# reads them (dropdowns, filters, etc.).
_admin_write = [Depends(require_role(RoleCode.ADMIN))]

router.include_router(
    build_crud_router(
        prefix="/organizations",
        tags=["Reference Data"],
        crud=organization_crud,
        read_schema=OrganizationRead,
        create_schema=OrganizationCreate,
        update_schema=OrganizationUpdate,
        write_dependencies=_admin_write,
    )
)
router.include_router(
    build_crud_router(
        prefix="/geos",
        tags=["Reference Data"],
        crud=geo_crud,
        read_schema=GeoRead,
        create_schema=GeoCreate,
        update_schema=GeoUpdate,
        write_dependencies=_admin_write,
    )
)
router.include_router(
    build_crud_router(
        prefix="/regions",
        tags=["Reference Data"],
        crud=region_crud,
        read_schema=RegionRead,
        create_schema=RegionCreate,
        update_schema=RegionUpdate,
        write_dependencies=_admin_write,
    )
)
router.include_router(
    build_crud_router(
        prefix="/project-types",
        tags=["Reference Data"],
        crud=project_type_crud,
        read_schema=ProjectTypeRead,
        create_schema=ProjectTypeCreate,
        update_schema=ProjectTypeUpdate,
        write_dependencies=_admin_write,
    )
)
router.include_router(
    build_crud_router(
        prefix="/products",
        tags=["Reference Data"],
        crud=product_crud,
        read_schema=ProductRead,
        create_schema=ProductCreate,
        update_schema=ProductUpdate,
        write_dependencies=_admin_write,
    )
)
router.include_router(
    build_crud_router(
        prefix="/accounts",
        tags=["Reference Data"],
        crud=account_crud,
        read_schema=AccountRead,
        create_schema=AccountCreate,
        update_schema=AccountUpdate,
        write_dependencies=_admin_write,
    )
)
router.include_router(
    build_crud_router(
        prefix="/reporting-periods",
        tags=["Reference Data"],
        crud=reporting_period_crud,
        read_schema=ReportingPeriodRead,
        create_schema=ReportingPeriodCreate,
        update_schema=ReportingPeriodUpdate,
        write_dependencies=_admin_write,
    )
)
