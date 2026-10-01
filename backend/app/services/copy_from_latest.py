"""'Copy from latest report' — prefill a new period's report from the owner's
most recent earlier report of the same period type, to save re-keying.

Never overwrites: a section (status/RAG category, or a measurement form) that
already has content in the target period is left alone, so the copy is safe to
press at any time. Rollup links are not copied — the copies start un-rolled.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect

from app.models.reference_data import ReportingPeriod

_SKIP_COLUMNS = {"id", "period_id", "created_at", "updated_at"}


async def _target_period(db: AsyncSession, period_id: UUID) -> ReportingPeriod:
    period = await db.get(ReportingPeriod, period_id)
    if period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reporting period not found")
    return period


async def _latest_earlier_period_id(
    db: AsyncSession, model: Any, owner_filter: Any, period: ReportingPeriod
) -> UUID | None:
    """Most recent earlier period of the same type that has rows in `model`."""
    stmt = (
        select(ReportingPeriod.id)
        .join(model, model.period_id == ReportingPeriod.id)
        .where(
            owner_filter,
            ReportingPeriod.period_type == period.period_type,
            ReportingPeriod.start_date < period.start_date,
        )
        .group_by(ReportingPeriod.id, ReportingPeriod.start_date)
        .order_by(ReportingPeriod.start_date.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalars().first()


async def copy_category_items(
    db: AsyncSession,
    *,
    model: Any,
    owner_column: Any,
    owner_id: UUID,
    period_id: UUID,
) -> tuple[int, UUID | None]:
    """Copy (category, description) rows from the latest earlier period into
    `period_id`, for categories that are still empty there. Returns
    (rows copied, source period id)."""
    period = await _target_period(db, period_id)
    owner_filter = owner_column == owner_id
    source_id = await _latest_earlier_period_id(db, model, owner_filter, period)
    if source_id is None:
        return 0, None

    filled = set(
        (
            await db.execute(
                select(model.category).where(owner_filter, model.period_id == period_id).distinct()
            )
        ).scalars()
    )
    source_rows = (
        (
            await db.execute(
                select(model).where(owner_filter, model.period_id == source_id).order_by(model.created_at)
            )
        )
        .scalars()
        .all()
    )
    now = datetime.now(UTC)
    copied = 0
    for row in source_rows:
        if row.category in filled:
            continue
        db.add(
            model(
                id=uuid4(),
                period_id=period_id,
                category=row.category,
                description=row.description,
                created_at=now,
                updated_at=now,
                **{owner_column.key: owner_id},
            )
        )
        copied += 1
    await db.flush()
    return copied, source_id


def _clone(row: Any, **overrides: Any) -> Any:
    """New instance of `row`'s model with the same column values."""
    mapper = inspect(type(row))
    data = {c.key: getattr(row, c.key) for c in mapper.column_attrs if c.key not in _SKIP_COLUMNS}
    data.update(overrides)
    return type(row)(**data)


async def copy_period_rows(
    db: AsyncSession,
    *,
    model: Any,
    project_id: UUID,
    period_id: UUID,
    child_model: Any | None = None,
    child_fk: str = "measurement_id",
) -> tuple[int, UUID | None]:
    """Copy a project's one-row-per-period record (and its child rows) from the
    latest earlier period, unless the target period already has one."""
    period = await _target_period(db, period_id)
    owner_filter = model.project_id == project_id
    if (await db.execute(select(model.id).where(owner_filter, model.period_id == period_id).limit(1))).first():
        return 0, None
    source_id = await _latest_earlier_period_id(db, model, owner_filter, period)
    if source_id is None:
        return 0, None
    source = (
        (await db.execute(select(model).where(owner_filter, model.period_id == source_id).limit(1)))
        .scalars()
        .first()
    )
    if source is None:
        return 0, None
    now = datetime.now(UTC)
    new_id = uuid4()
    db.add(_clone(source, id=new_id, period_id=period_id, created_at=now, updated_at=now))
    await db.flush()
    if child_model is not None:
        children = (
            (await db.execute(select(child_model).where(getattr(child_model, child_fk) == source.id)))
            .scalars()
            .all()
        )
        for child in children:
            db.add(_clone(child, id=uuid4(), **{child_fk: new_id}))
        await db.flush()
    return 1, source_id
