"""Date rule shared by the DE assessments tied to a reporting period (Account
Assessment, Project "Delivery Risk Review"): an assessment stays valid for 35
days, so it can be reused for a period ending up to 35 days after it. The
assessment date may be after the period end date (the normal case) but not more
than 35 days before it."""

from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference_data import ReportingPeriod

ASSESSMENT_WINDOW_DAYS = 35


async def check_assessment_window(db: AsyncSession, period_id: UUID | None, assessment_date: date | None) -> None:
    if period_id is None or assessment_date is None:
        return
    period = await db.get(ReportingPeriod, period_id)
    if period is None:
        return
    earliest = period.end_date - timedelta(days=ASSESSMENT_WINDOW_DAYS)
    if assessment_date < earliest:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Assessment date cannot be more than {ASSESSMENT_WINDOW_DAYS} days before the period end date "
            f"({period.end_date.isoformat()}); the earliest allowed date is {earliest.isoformat()}.",
        )
