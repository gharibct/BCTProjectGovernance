from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_account_or_geo_scope
from app.core.db import get_db
from app.crud.account_health_declarations import account_health_declaration_crud, account_health_item_crud
from app.models.account_health_declarations import AccountHealthDeclaration, AccountHealthItem
from app.models.reference_data import ReportingPeriod
from app.models.regional_status import AccountStatusReport
from app.schemas.account_health_declarations import (
    AccountHealthDeclarationCreate,
    AccountHealthDeclarationRead,
    AccountHealthDeclarationUpdate,
    AccountHealthItemCreate,
    AccountHealthItemRead,
    AccountHealthItemUpdate,
)
from app.schemas.enums import Category, RoleCode
from app.services.health_rollup import compute_overall_rating
from app.services.report_lock import assert_report_editable

# Account RAG Status — account-level equivalent of health_declarations.py,
# minus the Project-record side-effect writes (accounts has no cached-health
# columns for anything to read one today).
router = APIRouter(prefix="/accounts/{account_id}/health-declarations", tags=["Account Reporting"])

# Account-Head work — also reachable by a Geo Head via the top-bar Work Context,
# for accounts in their own geo (require_account_or_geo_scope).
_account_manager_write = [Depends(require_account_or_geo_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]


def _by_period_start(model: type) -> Any:
    return select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()


# RAG Status is filed as part of the Account Status Report package (see
# submit-report-action.tsx's "Update the report on Account Reporting / RAG
# Status, then resubmit") — it freezes with it, gated on the same
# account_status_reports row for this account + period.
async def _assert_period_editable(db: AsyncSession, account_id: UUID, period_id: UUID) -> None:
    stmt = select(AccountStatusReport.status).where(
        AccountStatusReport.account_id == account_id, AccountStatusReport.period_id == period_id
    )
    assert_report_editable((await db.execute(stmt)).scalars().first())


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


@router.post(
    "",
    response_model=AccountHealthDeclarationRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=_account_manager_write,
)
async def create_account_health_declaration(
    account_id: UUID,
    payload: AccountHealthDeclarationCreate,
    db: AsyncSession = Depends(get_db),
):
    await _assert_period_editable(db, account_id, payload.period_id)
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


@router.put("/{declaration_id}", response_model=AccountHealthDeclarationRead, dependencies=_account_manager_write)
async def update_account_health_declaration(
    account_id: UUID,
    declaration_id: UUID,
    payload: AccountHealthDeclarationUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await account_health_declaration_crud.get(db, declaration_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health declaration not found")
    await _assert_period_editable(db, account_id, obj.period_id)

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


# RAG Status grids (mirrors health_declarations.py's items_router exactly —
# see db/tables/41_health_items.sql). No rollup-status endpoint here: there
# is no further Account -> Geo rollup for RAG Status notes.
items_router = APIRouter(prefix="/accounts/{account_id}/health-items", tags=["Account Reporting"])


@items_router.get("", response_model=list[AccountHealthItemRead])
async def list_account_health_items(
    account_id: UUID,
    period_id: UUID,
    category: Category,
    db: AsyncSession = Depends(get_db),
):
    items, _ = await account_health_item_crud.list(
        db,
        filters={
            AccountHealthItem.account_id: account_id,
            AccountHealthItem.period_id: period_id,
            AccountHealthItem.category: category,
        },
        limit=500,
    )
    return items


@items_router.post(
    "", response_model=AccountHealthItemRead, status_code=status.HTTP_201_CREATED, dependencies=_account_manager_write
)
async def create_account_health_item(
    account_id: UUID, payload: AccountHealthItemCreate, db: AsyncSession = Depends(get_db)
):
    await _assert_period_editable(db, account_id, payload.period_id)
    return await account_health_item_crud.create(db, payload, account_id=account_id)


@items_router.put("/{item_id}", response_model=AccountHealthItemRead, dependencies=_account_manager_write)
async def update_account_health_item(
    account_id: UUID, item_id: UUID, payload: AccountHealthItemUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await account_health_item_crud.get(db, item_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health item not found")
    await _assert_period_editable(db, account_id, obj.period_id)
    return await account_health_item_crud.update(db, obj, payload)


@items_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_account_manager_write)
async def delete_account_health_item(account_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await account_health_item_crud.get(db, item_id)
    if obj is None or obj.account_id != account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health item not found")
    await _assert_period_editable(db, account_id, obj.period_id)
    await account_health_item_crud.delete(db, obj)
