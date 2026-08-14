-- Project -> Account rollup for RAG Status notes (see
-- backend/app/services/account_health_rollup.py): tracks whether a
-- project's own health item has been pulled into its account's register or
-- dismissed. Mirrors 39_project_status_item_rollup.sql. A later, separate
-- ALTER (rather than edited into 41_health_items.sql's CREATE TABLE)
-- because the FK target, account_health_items, is defined in that same file
-- 41 but after project_health_items — keeping this in its own later file
-- avoids a fresh run_all.sql failing on a forward reference either way.
-- account_health_items gets no equivalent columns — there is no Account ->
-- Geo rollup for RAG Status.

ALTER TABLE project_health_items ADD COLUMN account_rollup_status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE project_health_items ADD COLUMN rolled_up_account_item_id UUID REFERENCES account_health_items(id) ON DELETE SET NULL;
