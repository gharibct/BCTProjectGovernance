-- Additive migration for an already-deployed DB: Project Charter gains an
-- optional "PM Attention / Involvement Needed" (High / Medium / Low).
-- Nullable TEXT, no backfill; safe to rerun. Fresh installs get the final
-- shape from tables/03_projects.sql.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_attention_needed TEXT;
