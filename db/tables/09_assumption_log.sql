-- Assumption Log (UX requirements §4.8). Validation Date/Status functions as
-- this log's review-style checkpoint (framed as one-time validation).

CREATE TABLE assumption_log (
    id UUID PRIMARY KEY,
    assumption_code TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    detailed_description TEXT,
    category TEXT,
    raised_by UUID REFERENCES users(id),
    raised_date DATE,
    owner UUID REFERENCES users(id),
    dependency_reference UUID REFERENCES dependency_log(id),
    impact_if_invalid TEXT,
    probability_of_failure TEXT, -- Low, Medium, High
    impact_rating TEXT, -- Low, Medium, High, Critical
    validation_date DATE,
    validation_status TEXT NOT NULL, -- Pending, Validated, Invalid
    mitigation_plan TEXT,
    contingency_plan TEXT,
    current_status TEXT NOT NULL, -- Open, Closed, Cancelled
    last_updated DATE,
    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_assumption_log_project_id ON assumption_log(project_id);
CREATE INDEX idx_assumption_log_current_status ON assumption_log(current_status);
CREATE INDEX idx_assumption_log_dependency_reference ON assumption_log(dependency_reference);

CREATE TRIGGER trg_assumption_log_updated_at BEFORE UPDATE ON assumption_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();
