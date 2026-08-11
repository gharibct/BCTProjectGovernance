-- AI-Assisted Project Governance (see AI-Implementation.md): per-field
-- extraction suggestions produced upstream (local LLM, delivered via Kafka)
-- for a given project screen. The app never writes AI values directly into
-- business tables — a row here is reviewed on the corresponding screen and
-- either applied (copied into that screen's own fields) or ignored; the
-- accepted value only becomes real project data once the user saves the
-- screen through its normal save action.
--
-- One row per (project, screen, period, field) — a fresh extraction for a
-- field that already has a suggestion replaces it (upsert) rather than
-- piling up history, since only the latest read matters for review.
--
-- period_id ties every suggestion to a reporting_periods row, including
-- suggestions produced at project-creation time: those use the seeded
-- sentinel period (code = 'BASELINE'), the same one health_declarations
-- uses for its initial, pre-reporting-cycle declaration.
--
-- status: pending | ignored | resolved (Pydantic-validated, see
-- schemas.enums.AiSuggestionStatus — no CHECK constraint, per this schema's
-- convention).
--   pending  - awaiting PM review, shown on screen
--   ignored  - PM explicitly dismissed it
--   resolved - screen was saved/edited/created while this was pending, so
--              it (and any value copied from it) is now just manual data

CREATE TABLE ai_field_suggestions (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    screen TEXT NOT NULL,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    field_key TEXT NOT NULL,
    value TEXT,
    confidence DOUBLE PRECISION NOT NULL,
    source_document TEXT,
    source_location TEXT,
    evidence TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, screen, period_id, field_key)
);

CREATE INDEX idx_ai_field_suggestions_project_screen_period ON ai_field_suggestions(project_id, screen, period_id);
