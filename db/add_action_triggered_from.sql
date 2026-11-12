-- Additive migration for an already-deployed DB: Actions gain an optional
-- "Action Triggered From" (QBR / Delivery Review / Account Planning / Sales
-- Review / Team Meeting / DE Assessment). Nullable TEXT, no backfill; safe to
-- rerun. Fresh installs get the final shape from tables/44_actions.sql.

ALTER TABLE actions ADD COLUMN IF NOT EXISTS triggered_from TEXT;
