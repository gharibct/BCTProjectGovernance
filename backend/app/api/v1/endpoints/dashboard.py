from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.schemas.dashboard import DashboardSummary
from app.schemas.enums import HealthRating
from app.services import dashboard as dashboard_service
from app.services.dashboard import DashboardFilters

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _filters(
    geo_id: UUID | None = Query(default=None),
    account_id: UUID | None = Query(default=None),
    project_type_id: UUID | None = Query(default=None),
    health_status: HealthRating | None = Query(default=None),
    geo_ids: list[UUID] | None = Query(default=None),
    account_ids: list[UUID] | None = Query(default=None),
) -> DashboardFilters:
    return DashboardFilters(
        geo_id=geo_id,
        account_id=account_id,
        project_type_id=project_type_id,
        health_status=health_status,
        geo_ids=geo_ids,
        account_ids=account_ids,
    )


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    filters: DashboardFilters = Depends(_filters),
    db: AsyncSession = Depends(get_db),
):
    return DashboardSummary(
        active_projects=await dashboard_service.count_active_projects(db, filters),
        projects_by_type=await dashboard_service.projects_by_type(db, filters),
        delayed_projects=await dashboard_service.count_delayed_projects(db, filters),
        open_risks=await dashboard_service.count_open_risks(db, filters),
        open_issues=await dashboard_service.count_open_issues(db, filters),
        pending_approvals=await dashboard_service.count_pending_approvals(db, filters),
        project_health=await dashboard_service.project_health_rows(db, filters),
        account_health=await dashboard_service.account_health_rows(db, filters),
        contractual_compliance=await dashboard_service.contractual_compliance_summary(db, filters),
        milestone_payments=await dashboard_service.milestone_payment_summary(db, filters),
        account_matrix=await dashboard_service.account_health_matrix(db, filters),
        project_matrix=await dashboard_service.project_health_matrix(db, filters),
        account_highlights=await dashboard_service.account_highlights(db, filters),
        project_highlights=await dashboard_service.project_highlights(db, filters),
    )
