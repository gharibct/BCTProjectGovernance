from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, project_scope_conditions, require_project_read_access
from app.core.db import get_db
from app.models.projects import Project
from app.models.reference_data import ReportingPeriod
from app.models.users import User
from app.schemas.project_performance import ProjectPerformanceDashboardSummary
from app.schemas.reporting_attestation import PageCompletionStatus
from app.services import dashboard as dashboard_service
from app.services.dashboard import DashboardFilters
from app.services.monthly_completion import compute_monthly_completion

router = APIRouter(prefix="/projects/{project_id}", tags=["Project Performance Dashboard"])

# Read access for the PM's own monthly dashboard and the Account/Geo Head's
# read-only Project Performance Dashboard view — also unconditionally open to
# DE/PMO/CXO/ADMIN, matching every other project-scoped read (see deps.py's
# require_project_read_access docstring).
_read_dep = require_project_read_access()


async def _monthly_period_or_error(db: AsyncSession, period_id: UUID) -> ReportingPeriod:
    period = await db.get(ReportingPeriod, period_id)
    if period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reporting period not found")
    if period.period_type != "Monthly":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The Project Performance Dashboard is Monthly-only")
    return period


@router.get(
    "/monthly-completion",
    response_model=list[PageCompletionStatus],
    dependencies=[Depends(_read_dep)],
)
async def get_monthly_completion(project_id: UUID, period_id: UUID = Query(...), db: AsyncSession = Depends(get_db)):
    period = await _monthly_period_or_error(db, period_id)
    return await compute_monthly_completion(db, project_id, period)


@router.get(
    "/performance-dashboard",
    response_model=ProjectPerformanceDashboardSummary,
    dependencies=[Depends(_read_dep)],
)
async def get_performance_dashboard(
    project_id: UUID, period_id: UUID = Query(...), db: AsyncSession = Depends(get_db)
):
    period = await _monthly_period_or_error(db, period_id)
    filters = DashboardFilters(project_id=project_id)
    completion = await compute_monthly_completion(db, project_id, period)

    return ProjectPerformanceDashboardSummary(
        period_id=period.id,
        period_label=period.label,
        metrics=await dashboard_service.metrics_compliance_summary(db, filters, [project_id], period),
        commitments=await dashboard_service.commitments_card_summary(db, filters),
        payment_milestones=await dashboard_service.payment_milestones_card_summary(db, filters),
        risks=await dashboard_service.risk_card_summary(db, filters),
        issues=await dashboard_service.issue_card_summary(db, filters),
        dependencies=await dashboard_service.dependency_card_summary(db, filters),
        assumptions=await dashboard_service.assumption_card_summary(db, filters),
        opportunities=await dashboard_service.opportunity_card_summary(db, filters),
        completion=completion,
        all_complete=all(item.complete for item in completion),
    )


# Select-Project grid (Report Project Performance): where each project stands on the
# monthly report for a chosen period — Completed (every section saved/attested),
# In Progress (some), Not Started (none). Scoped like GET /projects.
period_router = APIRouter(prefix="/project-performance", tags=["Project Performance Dashboard"])


@period_router.get("/status-by-period")
async def performance_status_by_period(
    period_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    period = await _monthly_period_or_error(db, period_id)
    project_ids = (
        await db.execute(select(Project.id).where(*await project_scope_conditions(db, current_user)))
    ).scalars().all()
    rows: list[dict[str, Any]] = []
    for pid in project_ids:
        completion = await compute_monthly_completion(db, pid, period)
        done = sum(1 for item in completion if item.complete)
        if completion and done == len(completion):
            label = "Completed"
        elif done:
            label = "In Progress"
        else:
            label = "Not Started"
        rows.append({"project_id": pid, "status": label})
    return rows
