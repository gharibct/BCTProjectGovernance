from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.db import get_db
from app.models.reference_data import ExchangeRate
from app.schemas.enums import RoleCode
from app.schemas.reference_data import ExchangeRateRead, ExchangeRateWrite
from app.services.exchange_rates import recompute_currency

# Project currency -> USD rates. Every authenticated role may read them; only
# Admin writes. Saving or removing a rate re-converts every project in that
# currency (projects.project_revenue_usd).
router = APIRouter(prefix="/exchange-rates", tags=["Reference Data"])

_admin = [Depends(require_role(RoleCode.ADMIN))]


@router.get("", response_model=list[ExchangeRateRead], dependencies=[Depends(get_current_user)])
async def list_exchange_rates(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(ExchangeRate).order_by(ExchangeRate.currency))).scalars().all()


@router.put("", response_model=ExchangeRateRead, dependencies=_admin)
async def upsert_exchange_rate(payload: ExchangeRateWrite, db: AsyncSession = Depends(get_db)):
    """Create the rate for a currency, or replace it if one already exists."""
    now = datetime.now(UTC)
    row = (
        await db.execute(select(ExchangeRate).where(ExchangeRate.currency == payload.currency))
    ).scalar_one_or_none()
    if row is None:
        row = ExchangeRate(
            id=uuid4(),
            currency=payload.currency,
            rate_to_usd=payload.rate_to_usd,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.rate_to_usd = payload.rate_to_usd
        row.updated_at = now
    await db.flush()
    await recompute_currency(db, payload.currency)
    await db.refresh(row)
    return row


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_admin)
async def delete_exchange_rate(rate_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(ExchangeRate, rate_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    currency = row.currency
    await db.delete(row)
    await db.flush()
    await recompute_currency(db, currency)
