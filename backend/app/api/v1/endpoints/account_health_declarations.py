from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.crud.account_health_declarations import account_health_declaration_crud
from app.models.account_health_declarations import AccountHealthDeclaration
from app.models.reference_data import ReportingPeriod
from app.schemas.account_health_declarations import (
    AccountHealthDeclarationCreate,
    AccountHealthDeclarationRead,
    AccountHealthDeclarationUpdate,
)
from app.services.health_rollup import compute_overall_rating

# Account RAG Status — account-level equivalent of health_declarations.py,
# minus the Project-record side-effect writes (accounts has no cached-health
# columns for anything to read one today).
router = APIRouter(prefix="/accounts/{account_id}/health-declarations", tags=["Account Reporting"])


def _by_period_start(model: type) -> Any:
    return select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()


@router.get("", response_model=list[AccountHealthDeclarationRead])
async def list_account_health_declarations(account_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await account_health_declaration_crud.list(
        db,
        filters={AccountHealthDeclaration.account_id: account_id},
        order_by=_by_period_start(AccountHealthDeclaration),
        limit=200,
    )
    return items


@router.get("/latest", response_model=AccountHealthDeclarationRead)
async def get_latest_account_health_declaration(account_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await account_health_declaration_crud.list(
        db,
        filters={AccountHealthDeclaration.account_id: account_id},
        order_by=_by_period_start(AccountHealthDeclaration),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No health declarations recorded for this account")
    return items[0]


@router.post("", response_model=AccountHealthDeclarationRead, status_code=status.HTTP_201_CREATED)
async def create_account_health_declaration(
    account_id: UUID,
    payload: AccountHealthDeclarationCreate,
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
    return await account_health_declaration_crud.create(db, payload, account_id=account_id, overall_rating=overall)


@router.put("/{declaration_id}", response_model=AccountHealthDeclarationRead)
async def update_account_health_declaration(
    account_id: UUID,
    declaration_id: UUID,
    payload: AccountHealthDeclarationUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await account_health_declaration_crud.get(db, declaration_id)
    if obj is None or obj.account_id != account_id:
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
    declaration = await account_health_declaration_crud.update(db, obj, payload)
    declaration.overall_rating = overall
    await db.flush()
    await db.refresh(declaration)
    return declaration
