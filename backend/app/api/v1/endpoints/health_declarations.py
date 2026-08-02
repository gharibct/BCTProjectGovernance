from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.crud.health_declarations import health_declaration_crud
from app.crud.projects import project_crud
from app.models.health_declarations import HealthDeclaration
from app.schemas.health_declarations import HealthDeclarationCreate, HealthDeclarationRead
from app.services.health_rollup import compute_overall_project_health, compute_overall_rating

# Append-only history (UX §4.3 / §7 item 1): list + latest + create only, no
# update/delete — a re-declaration is a new dated row, not an edit.
router = APIRouter(prefix="/projects/{project_id}/health-declarations", tags=["Health Declarations"])


@router.get("", response_model=list[HealthDeclarationRead])
async def list_health_declarations(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await health_declaration_crud.list(
        db,
        filters={HealthDeclaration.project_id: project_id},
        order_by=desc(HealthDeclaration.declaration_date),
        limit=200,
    )
    return items


@router.get("/latest", response_model=HealthDeclarationRead)
async def get_latest_health_declaration(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await health_declaration_crud.list(
        db,
        filters={HealthDeclaration.project_id: project_id},
        order_by=desc(HealthDeclaration.declaration_date),
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
