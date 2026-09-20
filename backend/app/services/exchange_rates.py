"""Project Revenue -> USD conversion.

Project values are entered in the project's own currency. `projects.
project_revenue_usd` holds that value converted at the Admin-maintained rate
(`exchange_rates.rate_to_usd` = USD per 1 unit of currency). USD needs no rate.
A project whose currency has no rate yet keeps a NULL USD value until one is
entered; saving/removing a rate re-converts every project in that currency.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.projects import Project
from app.models.reference_data import ExchangeRate

_CENTS = Decimal("0.01")


def normalize_currency(currency: str | None) -> str | None:
    code = (currency or "").strip().upper()
    return code or None


def convert_to_usd(amount: Decimal | None, currency: str | None, rate: Decimal | None) -> Decimal | None:
    """`rate` is USD per 1 unit of `currency`; ignored for USD."""
    code = normalize_currency(currency)
    if amount is None or code is None:
        return None
    if code == "USD":
        return Decimal(amount).quantize(_CENTS, ROUND_HALF_UP)
    if rate is None:
        return None
    return (Decimal(amount) * Decimal(rate)).quantize(_CENTS, ROUND_HALF_UP)


async def get_rate(db: AsyncSession, currency: str | None) -> Decimal | None:
    code = normalize_currency(currency)
    if code is None or code == "USD":
        return None
    return (
        await db.execute(select(ExchangeRate.rate_to_usd).where(ExchangeRate.currency == code))
    ).scalar_one_or_none()


async def sync_project_revenue_usd(db: AsyncSession, project: Project) -> None:
    """Recompute one project's USD revenue from its current revenue/currency."""
    rate = await get_rate(db, project.project_currency)
    project.project_revenue_usd = convert_to_usd(project.project_revenue, project.project_currency, rate)
    await db.flush()


async def recompute_currency(db: AsyncSession, currency: str) -> None:
    """Re-convert every project in `currency` (after its rate is saved/removed)."""
    code = normalize_currency(currency)
    if code is None or code == "USD":
        return
    rate = await get_rate(db, code)
    value = None if rate is None else func.round(Project.project_revenue * rate, 2)
    await db.execute(update(Project).where(Project.project_currency == code).values(project_revenue_usd=value))
