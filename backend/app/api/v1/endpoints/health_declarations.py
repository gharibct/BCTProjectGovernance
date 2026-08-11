from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.crud.health_declarations import health_declaration_crud
from app.crud.projects import project_crud
from app.models.health_declarations import HealthDeclaration
from app.models.reference_data import ReportingPeriod
from app.schemas.health_declarations import HealthDeclarationCreate, HealthDeclarationRead, HealthDeclarationUpdate
from app.services.health_rollup import compute_overall_project_health, compute_overall_rating

# History (UX §4.3 / §7 item 1): list + latest + create + edit, one
# declaration per project+period — same shape as Project Status
# (project_status.py) minus the Draft/Submitted status.
router = APIRouter(prefix="/projects/{project_id}/health-declarations", tags=["Health Declarations"])


# Declarations are keyed off a reporting_periods row rather than a raw date
# (see db/tables/04_health_declarations.sql), so ordering has to sort by that
# period's start_date via a correlated subquery — same pattern as
# project_status.py's _by_period_start.
def _by_period_start(model: type) -> Any:
    return (
        select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()
    )


@router.get("", response_model=list[HealthDeclarationRead])
async def list_health_declarations(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await health_declaration_crud.list(
        db,
        filters={HealthDeclaration.project_id: project_id},
        order_by=_by_period_start(HealthDeclaration),
        limit=200,
    )
    return items


@router.get("/latest", response_model=HealthDeclarationRead)
async def get_latest_health_declaration(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await health_declaration_crud.list(
        db,
        filters={HealthDeclaration.project_id: project_id},
        order_by=_by_period_start(HealthDeclaration),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No health declarations recorded for this project")
    return items[0]


@router.post("", response_model=HealthDeclarationRead, status_code=status.HTTP_201_CREATED)
async def create_health_declaration(
    project_id: UUID,
    payload: HealthDeclarationCreate,
    db: AsyncSession = Depends(get_db),
):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    overall = compute_overall_rating(
        [
            payload.core_delivery_rating,
            payload.people_rating,
            payload.operational_rating,
            payload.customer_rating,
            payload.financial_rating,
            payload.compliance_rating,
        ]
    )
    declaration = await health_declaration_crud.create(db, payload, project_id=project_id, overall_rating=overall)

    # Keep the Project Charter's cached health fields in sync (UX §4.3).
    project.delivery_declared_overall_health = overall
    project.overall_project_health = compute_overall_project_health(overall, project.de_assessed_project_health)
    await db.flush()

    return declaration


@router.put("/{declaration_id}", response_model=HealthDeclarationRead)
async def update_health_declaration(
    project_id: UUID,
    declaration_id: UUID,
    payload: HealthDeclarationUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await health_declaration_crud.get(db, declaration_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health declaration not found")
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    overall = compute_overall_rating(
        [
            payload.core_delivery_rating,
            payload.people_rating,
            payload.operational_rating,
            payload.customer_rating,
            payload.financial_rating,
            payload.compliance_rating,
        ]
    )
    declaration = await health_declaration_crud.update(db, obj, payload)
    declaration.overall_rating = overall
    await db.flush()
    await db.refresh(declaration)

    # Keep the Project Charter's cached health fields in sync (UX §4.3).
    project.delivery_declared_overall_health = overall
    project.overall_project_health = compute_overall_project_health(overall, project.de_assessed_project_health)
    await db.flush()

    return declaration
