-- Backs human-readable code generation (Project Code PRJ-2026-0042, Risk Code
-- RSK-2026-0001, etc.) used across the Charter and RAID logs. Not in the
-- original UX requirements sheet — added because those codes need a
-- transaction-safe counter somewhere; the API's code_generator service reads
-- and increments this row-per-(entity_code, period_key) inside the same
-- transaction as the record it's numbering.

CREATE TABLE id_sequences (
    id UUID PRIMARY KEY,
    entity_code TEXT NOT NULL,  -- PROJECT, RISK, ISSUE, DEPENDENCY, ASSUMPTION, OPPORTUNITY, DE_ALERT
    period_key TEXT NOT NULL,   -- calendar year the sequence resets on, e.g. '2026'
    last_number INTEGER NOT NULL,

    UNIQUE (entity_code, period_key)
);
