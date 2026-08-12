-- Account -> Geo rollup (see backend/app/services/geo_rollup.py): tracks
-- whether an account's own status item has been pulled into its geo's
-- register or dismissed. Mirrors 39_project_status_item_rollup.sql one
-- level up. A later, separate ALTER (rather than edited into
-- 36_account_geo_status_items.sql's CREATE TABLE) because the FK target,
-- geo_status_items, is defined in that same file 36 but after
-- account_status_items — keeping this in its own later file avoids a fresh
-- run_all.sql failing on a forward reference either way.

ALTER TABLE account_status_items ADD COLUMN account_rollup_status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE account_status_items ADD COLUMN rolled_up_geo_item_id UUID REFERENCES geo_status_items(id) ON DELETE SET NULL;
