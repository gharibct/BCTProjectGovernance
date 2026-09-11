-- Additive migration for an already-deployed DB: New Project Creation flow.
-- Safe to run once against a live DB with existing data — creates two new
-- tables only, no drops. Fresh installs get these from
-- tables/50_project_creation_requests.sql.

CREATE TABLE IF NOT EXISTS project_creation_requests (
    id UUID PRIMARY KEY,
    project_name TEXT NOT NULL,
    project_manager_id UUID REFERENCES users(id),
    status TEXT NOT NULL, -- Pending, Approved
    requested_by UUID REFERENCES users(id),
    approved_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pcr_status ON project_creation_requests(status);
CREATE INDEX IF NOT EXISTS idx_pcr_project_manager_id ON project_creation_requests(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_pcr_requested_by ON project_creation_requests(requested_by);

-- Org / GEO / Region / Account profile captured on the request (added later; see
-- add_pcr_profile_fields.sql for the standalone patch against an even older DB).
ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES geos(id);
ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
ALTER TABLE project_creation_requests ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
CREATE INDEX IF NOT EXISTS idx_pcr_geo_id ON project_creation_requests(geo_id);
CREATE INDEX IF NOT EXISTS idx_pcr_region_id ON project_creation_requests(region_id);
CREATE INDEX IF NOT EXISTS idx_pcr_account_id ON project_creation_requests(account_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pcr_updated_at') THEN
        CREATE TRIGGER trg_pcr_updated_at
            BEFORE UPDATE ON project_creation_requests
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS project_creation_request_oracle_ids (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES project_creation_requests(id) ON DELETE CASCADE,
    oracle_project_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (request_id, oracle_project_id)
);

CREATE INDEX IF NOT EXISTS idx_pcr_oracle_ids_request_id ON project_creation_request_oracle_ids(request_id);
