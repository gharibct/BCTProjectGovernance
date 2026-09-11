-- New Project Creation flow. An Account Head / Geo Head submits a lightweight
-- creation request (project name + Project Manager + one or more Oracle Project
-- IDs). Delivery Excellence then approves it — which materialises a real
-- projects row in Draft (project_creation_requests.approved_project_id) plus the
-- project_oracle_ids — or rejects it with a mandatory reason, which retains the
-- request row as 'Rejected' with review_remarks so the requester can see why.
-- This is deliberately NOT a replica of the projects table: only the few fields
-- the pre-approval form collects live here.
-- status values: Pending, Approved, Rejected.

CREATE TABLE project_creation_requests (
    id UUID PRIMARY KEY,
    project_name TEXT NOT NULL,
    project_manager_id UUID REFERENCES users(id),
    -- Project profile the requester pre-fills (mirrors the charter's Org / GEO /
    -- Region / Account controls); copied onto the Draft project on approval.
    organization_id UUID REFERENCES organizations(id),
    geo_id UUID REFERENCES geos(id),
    region_id UUID REFERENCES regions(id),
    account_id UUID REFERENCES accounts(id),
    status TEXT NOT NULL, -- Pending, Approved, Rejected
    requested_by UUID REFERENCES users(id),
    approved_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_pcr_status ON project_creation_requests(status);
CREATE INDEX idx_pcr_project_manager_id ON project_creation_requests(project_manager_id);
CREATE INDEX idx_pcr_requested_by ON project_creation_requests(requested_by);
CREATE INDEX idx_pcr_geo_id ON project_creation_requests(geo_id);
CREATE INDEX idx_pcr_region_id ON project_creation_requests(region_id);
CREATE INDEX idx_pcr_account_id ON project_creation_requests(account_id);

CREATE TRIGGER trg_pcr_updated_at
    BEFORE UPDATE ON project_creation_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Oracle Project ID(s) captured on the request — copied into project_oracle_ids
-- verbatim on approval.
CREATE TABLE project_creation_request_oracle_ids (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES project_creation_requests(id) ON DELETE CASCADE,
    oracle_project_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (request_id, oracle_project_id)
);

CREATE INDEX idx_pcr_oracle_ids_request_id ON project_creation_request_oracle_ids(request_id);
