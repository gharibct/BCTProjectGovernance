-- Opportunity Log (UX requirements §4.9). last_review_date/next_review_date are
-- a proposed addition (§7 item 6) for monthly-review consistency with Risk Log.

CREATE TABLE opportunity_log (
    id UUID PRIMARY KEY,
    opportunity_code TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    opportunity_title TEXT NOT NULL,
    opportunity_description TEXT,
    category TEXT,
    identified_by UUID REFERENCES users(id),
    identified_date DATE,
    opportunity_owner UUID REFERENCES users(id),
    impact TEXT, -- Very Low, Low, Medium, High
    expected_benefit TEXT, -- Time, Cost, Quality, Revenue
    estimated_benefit NUMERIC(18, 2),
    benefit_type TEXT, -- Cost Saving, Revenue Increase, Quality Improvement, Customer Satisfaction
    exploitation_strategy TEXT, -- Exploit, Enhance, Share, Accept
    action_plan TEXT,
    target_implementation_date DATE,
    status TEXT NOT NULL, -- Identified, Approved, Implemented, Closed
    approval_required BOOLEAN NOT NULL,
    approved_by UUID REFERENCES users(id),
    actual_benefit NUMERIC(18, 2),
    closure_date DATE,
    remarks TEXT,
    last_review_date DATE,
    next_review_date DATE,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_opportunity_log_project_id ON opportunity_log(project_id);
CREATE INDEX idx_opportunity_log_status ON opportunity_log(status);
CREATE INDEX idx_opportunity_log_next_review_date ON opportunity_log(next_review_date);

CREATE TRIGGER trg_opportunity_log_updated_at BEFORE UPDATE ON opportunity_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();
