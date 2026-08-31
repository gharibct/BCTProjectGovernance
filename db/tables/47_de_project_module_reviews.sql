-- Per-module DE Assessor Action for the Project Governance Review workspace
-- (design-reference/de-approval). One row per (project, governance module) the
-- DE has touched during review; the absence of a row means "Not Reviewed".
-- The set of module_key values is fixed by app.schemas.enums.GovernanceModuleKey
-- (project_profile, scope_schedule, map_oracle_projects, contractual_compliance,
-- raido, measurement).

CREATE TABLE de_project_module_reviews (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    review_action TEXT NOT NULL DEFAULT 'Not Reviewed', -- Not Reviewed, Reviewed, Gap Identified
    remarks TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, module_key)
);

CREATE INDEX idx_de_project_module_reviews_project_id ON de_project_module_reviews(project_id);

CREATE TRIGGER trg_de_project_module_reviews_updated_at
    BEFORE UPDATE ON de_project_module_reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
