-- Risk Log (UX requirements §4.5). Items are created/edited ad hoc; the
-- register as a whole is reviewed monthly via last_review_date/next_review_date.

CREATE TABLE risk_log (
    id UUID PRIMARY KEY,
    risk_code TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    risk_title TEXT NOT NULL,
    risk_description TEXT,
    risk_category TEXT, -- Core Delivery, People, Operational, Customer, Financial, Compliance
    risk_type TEXT, -- Internal, External
    identified_by UUID REFERENCES users(id),
    identified_date DATE,
    risk_owner UUID REFERENCES users(id),
    trigger_event TEXT,
    probability TEXT, -- Very Low, Low, Medium, High, Very High
    impact TEXT, -- Very Low, Low, Medium, High, Critical
    risk_score INTEGER, -- computed: Probability x Impact
    severity TEXT, -- Low, Medium, High, Critical
    affected_deliverables TEXT,
    affected_milestone TEXT,
    response_strategy TEXT, -- Avoid, Mitigate, Transfer, Accept
    mitigation_plan TEXT,
    contingency_plan TEXT,
    residual_risk TEXT,
    target_resolution_date DATE,
    current_status TEXT NOT NULL, -- Open, Monitoring, Closed
    escalation_required BOOLEAN NOT NULL,
    escalated_to TEXT,
    last_review_date DATE,
    next_review_date DATE,
    closure_date DATE,
    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_risk_log_project_id ON risk_log(project_id);
CREATE INDEX idx_risk_log_current_status ON risk_log(current_status);
CREATE INDEX idx_risk_log_next_review_date ON risk_log(next_review_date);

CREATE TRIGGER trg_risk_log_updated_at BEFORE UPDATE ON risk_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();
