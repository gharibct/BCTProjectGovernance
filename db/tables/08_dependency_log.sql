-- Dependency Log (UX requirements §4.7). last_review_date/next_review_date are
-- a proposed addition (§7 item 5) for monthly-review consistency with Risk Log.

CREATE TABLE dependency_log (
    id UUID PRIMARY KEY,
    dependency_code TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    dependency_title TEXT NOT NULL,
    description TEXT,
    dependency_type TEXT, -- Internal, External, Vendor, Customer, Infrastructure, Regulatory, Third Party
    category TEXT,
    depends_on TEXT,
    related_task_milestone TEXT,
    required_by_date DATE,
    owner UUID REFERENCES users(id),
    dependency_status TEXT NOT NULL, -- Not Started, In Progress, Completed, Blocked
    criticality TEXT, -- Low, Medium, High, Critical
    impact_if_delayed TEXT,
    probability_of_delay TEXT, -- Low, Medium, High
    mitigation_plan TEXT,
    escalation_required BOOLEAN NOT NULL,
    escalation_level TEXT, -- Project Manager, Delivery Manager, Steering Committee
    actual_completion_date DATE,
    last_updated DATE,
    remarks TEXT,
    last_review_date DATE,
    next_review_date DATE,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_dependency_log_project_id ON dependency_log(project_id);
CREATE INDEX idx_dependency_log_status ON dependency_log(dependency_status);
CREATE INDEX idx_dependency_log_next_review_date ON dependency_log(next_review_date);

CREATE TRIGGER trg_dependency_log_updated_at BEFORE UPDATE ON dependency_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();
