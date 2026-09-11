-- Additive migration for an already-deployed DB. Adds the Org / GEO / Region /
-- Account profile fields to project_creation_requests so an Account Head / Geo
-- Head pre-fills them on the creation request (mirroring the charter controls);
-- they are copied onto the Draft project on approval.
-- Safe to run once. Fresh installs get the final shape from
-- tables/50_project_creation_requests.sql.

BEGIN;

ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES geos(id);
ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

CREATE INDEX IF NOT EXISTS idx_pcr_geo_id ON project_creation_requests(geo_id);
CREATE INDEX IF NOT EXISTS idx_pcr_region_id ON project_creation_requests(region_id);
CREATE INDEX IF NOT EXISTS idx_pcr_account_id ON project_creation_requests(account_id);

COMMIT;
