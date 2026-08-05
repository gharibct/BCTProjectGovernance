from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit,
    contractual,
    dashboard,
    data_integrity,
    de_assessment,
    health_declarations,
    integrations,
    measurement,
    metric_target,
    project_status,
    projects,
    raid,
    reference_data,
    users,
)

api_router = APIRouter()

api_router.include_router(reference_data.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(health_declarations.router)
api_router.include_router(project_status.router)
api_router.include_router(raid.router)
api_router.include_router(measurement.router)
api_router.include_router(metric_target.router)
api_router.include_router(contractual.router)
api_router.include_router(de_assessment.router)
api_router.include_router(data_integrity.router)
api_router.include_router(integrations.router)
api_router.include_router(audit.router)
api_router.include_router(dashboard.router)
