-- Additive migration for an already-deployed DB. Adds accounts.region_id so an
-- Account records its Region (Geo -> Region), alongside the existing geo_id.
-- Mirrors projects.region_id. Existing rows are left NULL and pick a Region the
-- next time the account is edited.
-- Safe to run once. Fresh installs get the final shape from tables/NN_*.sql.

BEGIN;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
CREATE INDEX IF NOT EXISTS idx_accounts_region_id ON accounts(region_id);

COMMIT;
