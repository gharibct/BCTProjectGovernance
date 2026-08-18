from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_geo_scope
from app.core.db import get_db
from app.crud.geo_health_declarations import geo_health_declaration_crud
from app.models.geo_health_declarations import GeoHealthDeclaration
from app.models.reference_data import ReportingPeriod
from app.schemas.enums import RoleCode
from app.schemas.geo_health_declarations import (
    GeoHealthDeclarationCreate,
    GeoHealthDeclarationRead,
    GeoHealthDeclarationUpdate,
)
from app.services.health_rollup import compute_overall_rating

# Geo RAG Status — geo-level equivalent of account_health_declarations.py.
router = APIRouter(prefix="/geos/{geo_id}/health-declarations", tags=["Geo Reporting"])

_geo_head_write = [Depends(require_geo_scope(RoleCode.GEO_HEAD, RoleCode.ADMIN))]


def _by_period_start(model: type) -> Any:
    return select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()


@router.get("", response_model=list[GeoHealthDeclarationRead])
async def list_geo_health_declarations(geo_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await geo_health_declaration_crud.list(
        db,
        filters={GeoHealthDeclaration.geo_id: geo_id},
        order_by=_by_period_start(GeoHealthDeclaration),
        limit=200,
    )
    return items


@router.get("/latest", response_model=GeoHealthDeclarationRead)
async def get_latest_geo_health_declaration(geo_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await geo_health_declaration_crud.list(
        db,
        filters={GeoHealthDeclaration.geo_id: geo_id},
        order_by=_by_period_start(GeoHealthDeclaration),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No health declarations recorded for this geo")
    return items[0]


@router.post(
    "", response_model=GeoHealthDeclarationRead, status_code=status.HTTP_201_CREATED, dependencies=_geo_head_write
)
async def create_geo_health_declaration(
    geo_id: UUID,
    payload: GeoHealthDeclarationCreate,
    db: AsyncSession = Depends(get_db),
):
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
    return await geo_health_declaration_crud.create(db, payload, geo_id=geo_id, overall_rating=overall)


@router.put("/{declaration_id}", response_model=GeoHealthDeclarationRead, dependencies=_geo_head_write)
async def update_geo_health_declaration(
    geo_id: UUID,
    declaration_id: UUID,
    payload: GeoHealthDeclarationUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await geo_health_declaration_crud.get(db, declaration_id)
    if obj is None or obj.geo_id != geo_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health declaration not found")

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
    declaration = await geo_health_declaration_crud.update(db, obj, payload)
    declaration.overall_rating = overall
    await db.flush()
    await db.refresh(declaration)
    return declaration
