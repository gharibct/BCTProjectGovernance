-- AI-Assisted Project Governance (see AI-Implementation.md §10): row-level
-- extraction suggestions for RAID grids (Risks/Issues/Dependencies/
-- Assumptions/Opportunities). Unlike ai_field_suggestions (one row per
-- project+screen+field), a row here represents a whole candidate entity —
-- confidence/evidence apply to the row as a whole, and `values` holds the
-- candidate's field values (matching that entity's Create schema).
--
-- period_id ties every suggestion to a reporting_periods row, same as
-- ai_field_suggestions (see 30_ai_field_suggestions.sql) — creation-time
-- suggestions use the seeded 'BASELINE' sentinel period.
--
-- match_key is a business identifier pulled from the source document for
-- this row (e.g. a risk_code already present in a re-uploaded register). A
-- fresh extraction whose match_key equals an existing PENDING suggestion's
-- match_key (within the same project+screen+period) replaces that row
-- in-place rather than piling up a duplicate. If match_key instead matches
-- an existing REAL entity's business code, matched_entity_id is set at
-- ingest time so the suggestion is reviewed as an update to that row rather
-- than a brand-new candidate — see crud.ai_row_suggestions.upsert_batch.
-- When match_key doesn't resolve either way (no code in the document, or a
-- screen with no business code column, e.g. commitments/milestones), the
-- suggestion is always a new candidate, matching the prior behavior.
--
-- status: pending | ignored | applied (Pydantic-validated, see
-- schemas.enums.AiRowSuggestionStatus — no CHECK constraint, per this
-- schema's convention).
--   pending  - awaiting PM review, shown on screen
--   ignored  - PM explicitly dismissed it
--   applied  - PM created (or updated, if matched_entity_id was set) the
--              real row from it, via that entity's own create/update
--              endpoint, same one manual entry uses

CREATE TABLE ai_row_suggestions (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    screen TEXT NOT NULL,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    -- named row_values, not values, since VALUES is a reserved SQL keyword —
    -- the ORM model/API/frontend all still call this field `values`.
    row_values JSONB NOT NULL,
    match_key TEXT,
    matched_entity_id UUID,
    confidence DOUBLE PRECISION NOT NULL,
    source_document TEXT,
    source_location TEXT,
    evidence TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ai_row_suggestions_project_screen_period ON ai_row_suggestions(project_id, screen, period_id);
