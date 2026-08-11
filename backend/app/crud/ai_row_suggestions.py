from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_row_suggestions import AiRowSuggestion
from app.models.raid import AssumptionLog, DependencyLog, IssueLog, OpportunityLog, RiskLog
from app.schemas.ai_row_suggestions import AiRowSuggestionIn
from app.schemas.enums import AiRowSuggestionStatus

# Screens whose entities have a server-generated business code to match
# against (see backend/app/services/code_generator.py). Screens not listed
# here (e.g. commitments/milestones, which have no business code column)
# never resolve a match — every row is treated as a brand-new candidate.
_MATCH_CONFIG = {
    "risks": (RiskLog, RiskLog.risk_code),
    "issues": (IssueLog, IssueLog.issue_code),
    "dependencies": (DependencyLog, DependencyLog.dependency_code),
    "assumptions": (AssumptionLog, AssumptionLog.assumption_code),
    "opportunities": (OpportunityLog, OpportunityLog.opportunity_code),
}


async def list_pending(
    db: AsyncSession, project_id: UUID, screen: str, period_id: UUID
) -> list[AiRowSuggestion]:
    stmt = select(AiRowSuggestion).where(
        AiRowSuggestion.project_id == project_id,
        AiRowSuggestion.screen == screen,
        AiRowSuggestion.period_id == period_id,
        AiRowSuggestion.status == AiRowSuggestionStatus.PENDING,
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_one_by_id(db: AsyncSession, suggestion_id: UUID) -> AiRowSuggestion | None:
    return await db.get(AiRowSuggestion, suggestion_id)


async def _get_pending_by_match_key(
    db: AsyncSession, project_id: UUID, screen: str, period_id: UUID, match_key: str
) -> AiRowSuggestion | None:
    stmt = select(AiRowSuggestion).where(
        AiRowSuggestion.project_id == project_id,
        AiRowSuggestion.screen == screen,
        AiRowSuggestion.period_id == period_id,
        AiRowSuggestion.match_key == match_key,
        AiRowSuggestion.status == AiRowSuggestionStatus.PENDING,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _resolve_matched_entity(
    db: AsyncSession, project_id: UUID, screen: str, match_key: str
) -> UUID | None:
    """Looks up match_key against the real entity table for this screen's
    business code (e.g. risk_log.risk_code), so a re-uploaded register that
    already carries our own generated code is reviewed as an update to that
    row rather than a new candidate. Screens with no business code column
    (see _MATCH_CONFIG) never resolve a match."""
    config = _MATCH_CONFIG.get(screen)
    if config is None:
        return None
    model, code_column = config
    stmt = select(model.id).where(model.project_id == project_id, code_column == match_key)
    return (await db.execute(stmt)).scalar_one_or_none()


async def upsert_batch(
    db: AsyncSession, project_id: UUID, screen: str, period_id: UUID, rows: list[AiRowSuggestionIn]
) -> list[AiRowSuggestion]:
    """Each candidate row carries an optional match_key (a business code read
    from the source document). A row whose match_key equals an existing
    PENDING suggestion's match_key (same project+screen+period) replaces that
    suggestion in place, so a repeat upload refreshes rather than duplicates.
    Otherwise match_key is looked up against the real entity table for this
    screen (see _resolve_matched_entity) — a hit means this is an update
    candidate for that row (matched_entity_id set), a miss or no match_key at
    all means a brand-new candidate, same as the prior insert-only
    behavior."""
    now = datetime.now(UTC)
    results: list[AiRowSuggestion] = []
    for row in rows:
        existing = (
            await _get_pending_by_match_key(db, project_id, screen, period_id, row.match_key)
            if row.match_key is not None
            else None
        )
        if existing is not None:
            existing.values = row.values
            existing.confidence = row.confidence
            existing.source_document = row.source_document
            existing.source_location = row.source_location
            existing.evidence = row.evidence
            existing.updated_at = now
            results.append(existing)
            continue

        matched_entity_id = (
            await _resolve_matched_entity(db, project_id, screen, row.match_key)
            if row.match_key is not None
            else None
        )
        obj = AiRowSuggestion(
            id=uuid4(),
            project_id=project_id,
            screen=screen,
            period_id=period_id,
            values=row.values,
            match_key=row.match_key,
            matched_entity_id=matched_entity_id,
            confidence=row.confidence,
            source_document=row.source_document,
            source_location=row.source_location,
            evidence=row.evidence,
            status=AiRowSuggestionStatus.PENDING,
            created_at=now,
            updated_at=now,
        )
        db.add(obj)
        results.append(obj)

    await db.flush()
    for obj in results:
        await db.refresh(obj)
    return results


async def replace_pending(
    db: AsyncSession, project_id: UUID, screen: str, period_id: UUID, rows: list[AiRowSuggestionIn]
) -> list[AiRowSuggestion]:
    """Used by seed-test-data: clears out this screen+period's existing
    pending test rows first, so repeated clicks reset the set instead of
    piling up duplicates."""
    for obj in await list_pending(db, project_id, screen, period_id):
        await db.delete(obj)
    await db.flush()
    return await upsert_batch(db, project_id, screen, period_id, rows)


async def mark_status(
    db: AsyncSession, suggestion: AiRowSuggestion, status: AiRowSuggestionStatus
) -> AiRowSuggestion:
    suggestion.status = status
    suggestion.updated_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(suggestion)
    return suggestion
