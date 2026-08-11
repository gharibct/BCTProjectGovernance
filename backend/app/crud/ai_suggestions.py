from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_suggestions import AiFieldSuggestion
from app.schemas.ai_suggestions import AiFieldSuggestionIn
from app.schemas.enums import AiSuggestionStatus


async def list_pending(
    db: AsyncSession, project_id: UUID, screen: str, period_id: UUID
) -> list[AiFieldSuggestion]:
    stmt = select(AiFieldSuggestion).where(
        AiFieldSuggestion.project_id == project_id,
        AiFieldSuggestion.screen == screen,
        AiFieldSuggestion.period_id == period_id,
        AiFieldSuggestion.status == AiSuggestionStatus.PENDING,
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_one(
    db: AsyncSession, project_id: UUID, screen: str, period_id: UUID, field_key: str
) -> AiFieldSuggestion | None:
    stmt = select(AiFieldSuggestion).where(
        AiFieldSuggestion.project_id == project_id,
        AiFieldSuggestion.screen == screen,
        AiFieldSuggestion.period_id == period_id,
        AiFieldSuggestion.field_key == field_key,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_one_by_id(db: AsyncSession, suggestion_id: UUID) -> AiFieldSuggestion | None:
    return await db.get(AiFieldSuggestion, suggestion_id)


async def upsert_batch(
    db: AsyncSession, project_id: UUID, screen: str, period_id: UUID, fields: list[AiFieldSuggestionIn]
) -> list[AiFieldSuggestion]:
    """A fresh extraction for a field replaces whatever suggestion is already
    there for that project+screen+period (new evidence deserves a fresh look,
    even if the previous read for that field had been ignored) — see
    30_ai_field_suggestions.sql."""
    now = datetime.now(UTC)
    results: list[AiFieldSuggestion] = []
    for field in fields:
        existing = await get_one(db, project_id, screen, period_id, field.field_key)
        if existing is not None:
            existing.value = field.value
            existing.confidence = field.confidence
            existing.source_document = field.source_document
            existing.source_location = field.source_location
            existing.evidence = field.evidence
            existing.status = AiSuggestionStatus.PENDING
            existing.updated_at = now
            results.append(existing)
        else:
            obj = AiFieldSuggestion(
                id=uuid4(),
                project_id=project_id,
                screen=screen,
                period_id=period_id,
                field_key=field.field_key,
                value=field.value,
                confidence=field.confidence,
                source_document=field.source_document,
                source_location=field.source_location,
                evidence=field.evidence,
                status=AiSuggestionStatus.PENDING,
                created_at=now,
                updated_at=now,
            )
            db.add(obj)
            results.append(obj)
    await db.flush()
    for obj in results:
        await db.refresh(obj)
    return results


async def ignore(db: AsyncSession, suggestion: AiFieldSuggestion) -> AiFieldSuggestion:
    suggestion.status = AiSuggestionStatus.IGNORED
    suggestion.updated_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(suggestion)
    return suggestion


async def resolve_all(db: AsyncSession, project_id: UUID, screen: str, period_id: UUID) -> int:
    """Called when the screen these suggestions belong to is saved/edited/
    created (AI-Implementation.md §9) — whatever is still pending at that
    point is now just manual data, applied or not."""
    pending = await list_pending(db, project_id, screen, period_id)
    now = datetime.now(UTC)
    for suggestion in pending:
        suggestion.status = AiSuggestionStatus.RESOLVED
        suggestion.updated_at = now
    await db.flush()
    return len(pending)
