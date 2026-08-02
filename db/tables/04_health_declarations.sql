-- Health Declaration History (UX requirements §4.3 control gap / §7 item 1):
-- a dated record of the Delivery Declared Project Health, one per PM
-- re-declaration cycle (proposed weekly), so trend/audit history is preserved
-- instead of a single overwritten "current" set of ratings.
-- Rating values (all *_rating columns): Red, Potential Red, Amber, Green.

CREATE TABLE health_declarations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    declaration_date DATE NOT NULL,

    core_delivery_rating TEXT NOT NULL,
    core_delivery_description TEXT,
    people_rating TEXT NOT NULL,
    people_description TEXT,
    operational_rating TEXT NOT NULL,
    operational_description TEXT,
    customer_rating TEXT NOT NULL,
    customer_description TEXT,
    financial_rating TEXT NOT NULL,
    financial_description TEXT,
    compliance_rating TEXT NOT NULL,
    compliance_description TEXT,

    -- Auto-calculated: if any category above is Red, overall is Red.
    overall_rating TEXT NOT NULL,

    declared_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, declaration_date)
);

CREATE INDEX idx_health_declarations_project_id ON health_declarations(project_id, declaration_date DESC);
