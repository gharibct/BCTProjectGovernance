"""Generates human-readable codes (PRJ-2026-0042, RSK-2026-0001, ...) backed by
the id_sequences table (db/tables/23_id_sequences.sql). Not part of the
original UX requirements sheet — added because those codes need a
transaction-safe counter. Call this inside the same DB transaction as the
record being numbered; SELECT ... FOR UPDATE on the sequence row serializes
concurrent generators for the same entity/year.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sequences import IdSequence

_PREFIXES = {
    "PROJECT": "PRJ",
    "RISK": "RSK",
    "ISSUE": "ISS",
    "DEPENDENCY": "DEP",
    "ASSUMPTION": "ASM",
    "OPPORTUNITY": "OPP",
    "DE_ALERT": "ALT",
}


async def generate_code(db: AsyncSession, entity_code: str) -> str:
    period_key = str(datetime.now(UTC).year)

    stmt = (
        select(IdSequence)
        .where(IdSequence.entity_code == entity_code, IdSequence.period_key == period_key)
        .with_for_update()
    )
    sequence = (await db.execute(stmt)).scalar_one_or_none()
    if sequence is None:
        sequence = IdSequence(id=uuid4(), entity_code=entity_code, period_key=period_key, last_number=0)
        db.add(sequence)
        await db.flush()

    sequence.last_number += 1
    await db.flush()

    return f"{_PREFIXES[entity_code]}-{period_key}-{sequence.last_number:04d}"
