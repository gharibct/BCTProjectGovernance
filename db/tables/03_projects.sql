-- Project Charter (UX requirements §4.3) — system-of-record for a project's
-- identity, resourcing, and rolled-up health.

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    project_code TEXT NOT NULL UNIQUE,
    project_name TEXT NOT NULL,
    contract_type TEXT, -- FPP, T&M, Capped T&M, Internal
    project_type_id UUID REFERENCES project_types(id),
    organization_id UUID REFERENCES organizations(id),
    project_owned TEXT, -- Fully Owned, Co-Owned, Customer Driven
    geo_id UUID REFERENCES geos(id),
    region_id UUID REFERENCES regions(id),
    account_id UUID REFERENCES accounts(id),
    project_manager_id UUID REFERENCES users(id),
    delivery_manager_id UUID REFERENCES users(id),
    delivery_excellence_id UUID REFERENCES users(id),
    customer_overview TEXT,
    project_scope_description TEXT,
    project_revenue NUMERIC(18, 2),
    project_currency CHAR(3),
    billing_type TEXT, -- FPP, FB, T&M, Product, Unit Based Billing, Others
    engagement_type TEXT, -- Implementation, Support
    critical_flag TEXT, -- Yes, No
    product_flag TEXT, -- Yes, No
    product_id UUID REFERENCES products(id), -- only meaningful when product_flag = 'Yes'

    -- Progress
    planned_start_date DATE,
    actual_start_date DATE,
    planned_end_date DATE,
    actual_end_date DATE,
    planned_duration_days INTEGER GENERATED ALWAYS AS (
        CASE WHEN planned_start_date IS NOT NULL AND planned_end_date IS NOT NULL
             THEN (planned_end_date - planned_start_date) END
    ) STORED,
    actual_duration_days INTEGER GENERATED ALWAYS AS (
        CASE WHEN actual_start_date IS NOT NULL AND actual_end_date IS NOT NULL
             THEN (actual_end_date - actual_start_date) END
    ) STORED,

    -- Treatment / Health
    applicable_phase TEXT, -- multi-select, comma-joined: Discovery / POC / Assessment / Consulting, Requirement, Design, CUT, Build & Deployment, Testing, UAT Support, Warranty, Support, Migration
    project_status TEXT NOT NULL, -- Draft, Pending Approval, Approved, Under Amendment
    lifecycle_status TEXT, -- Ongoing, Hold, Closed, Open Only for Billing (null = follow project_status)
    -- Denormalized read-only caches, kept in sync by the application whenever a
    -- health_declarations or de_assessments row is recorded (see 04_health_declarations.sql,
    -- 19_de_assessments.sql). overall_project_health is the highest-severity of the two.
    -- Health values: Red, Potential Red, Amber, Green.
    delivery_declared_overall_health TEXT,
    de_assessed_project_health TEXT,
    overall_project_health TEXT,

    -- DE governance approval (design-reference/de-approval). A project moves
    -- PM "Send To Approval" -> project_status = 'Pending Approval'; the
    -- allocated DE then reviews and either approves (project_status =
    -- 'Approved') or returns it (project_status = 'Draft'). de_review_status is
    -- the review sub-state; NULL = allocated but not yet opened by the DE.
    de_review_status TEXT, -- In Review, Returned, Approved
    de_review_remarks TEXT, -- mandatory DE Review Remarks captured at Approve / Return
    de_reviewed_by UUID REFERENCES users(id),
    de_reviewed_at TIMESTAMPTZ,
    de_allocated_at TIMESTAMPTZ, -- set when a DE is assigned via DE Project Allocation

    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_projects_project_type_id ON projects(project_type_id);
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_projects_geo_id ON projects(geo_id);
CREATE INDEX idx_projects_region_id ON projects(region_id);
CREATE INDEX idx_projects_product_id ON projects(product_id);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_project_manager_id ON projects(project_manager_id);
CREATE INDEX idx_projects_overall_project_health ON projects(overall_project_health);
CREATE INDEX idx_projects_project_status ON projects(project_status);
CREATE INDEX idx_projects_lifecycle_status ON projects(lifecycle_status);
CREATE INDEX idx_projects_delivery_excellence_id ON projects(delivery_excellence_id);
CREATE INDEX idx_projects_de_review_status ON projects(de_review_status);

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Oracle Project ID(s) — a project can map to multiple Oracle project IDs.
CREATE TABLE project_oracle_ids (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    oracle_project_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, oracle_project_id)
);

CREATE INDEX idx_project_oracle_ids_project_id ON project_oracle_ids(project_id);

-- Resource Allocation — sourced from BCT Oracle App (UX §4.3); synced_at tracks
-- last sync. Head Count and total FTE are derived (COUNT/SUM) rather than stored.
CREATE TABLE project_resources (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    resource_name TEXT NOT NULL,
    oracle_resource_id TEXT,
    role TEXT,
    fte_allocation NUMERIC(5, 2) NOT NULL,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_project_resources_project_id ON project_resources(project_id);

CREATE TRIGGER trg_project_resources_updated_at BEFORE UPDATE ON project_resources FOR EACH ROW EXECUTE FUNCTION set_updated_at();
