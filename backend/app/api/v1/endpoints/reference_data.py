from fastapi import APIRouter

from app.api.v1.factory import build_crud_router
from app.crud.reference_data import account_crud, geo_crud, organization_crud, project_type_crud, reporting_period_crud
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
    ProjectTypeCreate,
    ProjectTypeRead,
    ProjectTypeUpdate,
    ReportingPeriodCreate,
    ReportingPeriodRead,
    ReportingPeriodUpdate,
)

router = APIRouter()

router.include_router(
    build_crud_router(
        prefix="/organizations",
        tags=["Reference Data"],
        crud=organization_crud,
        read_schema=OrganizationRead,
        create_schema=OrganizationCreate,
        update_schema=OrganizationUpdate,
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
    )
)
