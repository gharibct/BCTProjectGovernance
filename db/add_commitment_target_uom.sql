-- Additive migration for an already-deployed DB: Contractual Commitments gain a
-- free-text "Target UOM" (unit of measure) alongside the existing Target value.
-- Single nullable TEXT column, no backfill. Guarded with IF NOT EXISTS so
-- reruns are safe. Fresh installs get the final shape from
-- tables/17_contractual_commitments.sql.

ALTER TABLE contractual_commitments ADD COLUMN IF NOT EXISTS target_uom TEXT;
