-- Issue Log (UX requirements §4.6). last_review_date/next_review_date are a
-- proposed addition (§7 item 4) for monthly-review consistency with Risk Log.

CREATE TABLE issue_log (
    id UUID PRIMARY KEY,
    issue_code TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    issue_title TEXT NOT NULL,
    issue_description TEXT,
    issue_category TEXT,
    priority TEXT, -- Low, Medium, High, Critical
    severity TEXT, -- Minor, Major, Critical
    raised_by UUID REFERENCES users(id),
    raised_date DATE,
    assigned_to UUID REFERENCES users(id),
    root_cause TEXT,
    business_impact TEXT,
    affected_deliverables TEXT,
    affected_milestone TEXT,
    resolution_plan TEXT,
    due_date DATE,
    actual_resolution_date DATE,
    status TEXT NOT NULL, -- New, Assigned, In Progress, Pending, Resolved, Closed
    escalation_level TEXT, -- PM, Delivery Manager, Steering Committee
    escalation_date DATE,
    resolution_summary TEXT,
    lessons_learned TEXT,
    closure_date DATE,
    remarks TEXT,
    last_review_date DATE,
    next_review_date DATE,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_issue_log_project_id ON issue_log(project_id);
CREATE INDEX idx_issue_log_status ON issue_log(status);
CREATE INDEX idx_issue_log_next_review_date ON issue_log(next_review_date);

CREATE TRIGGER trg_issue_log_updated_at BEFORE UPDATE ON issue_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();
