from fastapi import APIRouter

from app.api.v1.endpoints import (
    account_health_declarations,
    account_health_rollup,
    account_rollup,
    actions,
    ai_row_suggestions,
    ai_suggestions,
    audit,
    contractual,
    dashboard,
    data_integrity,
    de_allocation,
    de_approval,
    de_assessment,
    de_findings,
    documents,
    executive_updates,
    geo_health_declarations,
    geo_rollup,
    health_declarations,
    integrations,
    measurement,
    metric_reference,
    metric_target,
    pm_findings,
    project_status,
    projects,
    raid,
    reference_data,
    regional_status,
    users,
)

api_router = APIRouter()

# auth.router is mounted separately in app.main (it must stay reachable
# without an existing session — login/callback/config).
api_router.include_router(reference_data.router)
api_router.include_router(metric_reference.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(ai_suggestions.router)
api_router.include_router(ai_row_suggestions.router)
api_router.include_router(documents.router)
api_router.include_router(health_declarations.router)
api_router.include_router(health_declarations.items_router)
api_router.include_router(project_status.router)
api_router.include_router(project_status.items_router)
api_router.include_router(project_status.activity_router)
api_router.include_router(raid.router)
api_router.include_router(measurement.router)
api_router.include_router(metric_target.router)
api_router.include_router(contractual.router)
api_router.include_router(de_assessment.router)
api_router.include_router(de_assessment.findings_router)
api_router.include_router(de_findings.router)
api_router.include_router(pm_findings.router)
api_router.include_router(de_allocation.router)
api_router.include_router(de_approval.router)
api_router.include_router(data_integrity.router)
api_router.include_router(integrations.router)
api_router.include_router(audit.router)
api_router.include_router(dashboard.router)
api_router.include_router(regional_status.account_status_router)
api_router.include_router(regional_status.geo_status_router)
api_router.include_router(regional_status.account_activity_router)
api_router.include_router(regional_status.geo_activity_router)
api_router.include_router(regional_status.account_status_items_router)
api_router.include_router(regional_status.geo_status_items_router)
api_router.include_router(account_health_declarations.router)
api_router.include_router(account_health_declarations.items_router)
api_router.include_router(geo_health_declarations.router)
api_router.include_router(account_rollup.router)
api_router.include_router(account_health_rollup.router)
api_router.include_router(geo_rollup.router)
api_router.include_router(executive_updates.router)
api_router.include_router(actions.router)
