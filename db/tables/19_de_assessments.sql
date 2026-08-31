-- DE Assessment Form (UX requirements §4.12) — Delivery Excellence's periodic
-- audit of a project. Assessment Date/Next Assessment Due Date and the history
-- list are a proposed addition (§7 items 10-12), mirroring Project Status.

CREATE TABLE de_assessments (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assessment_date DATE,
    de_assessed_project_health TEXT NOT NULL, -- Red, Potential Red, Amber, Green
    pci_score NUMERIC(6, 2),
    remarks TEXT, -- DE's justification for the rating (DE Assessment Workspace)
    status TEXT NOT NULL DEFAULT 'Submitted', -- Draft, Submitted ("Not Started" = no row)
    next_assessment_due_date DATE,
    assessed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, assessment_date)
);

CREATE INDEX idx_de_assessments_project_id ON de_assessments(project_id, assessment_date DESC);

CREATE TRIGGER trg_de_assessments_updated_at BEFORE UPDATE ON de_assessments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Raised automatically when de_assessed_project_health is not Green.
CREATE TABLE de_assessment_alerts (
    id UUID PRIMARY KEY,
    alert_code TEXT NOT NULL UNIQUE,
    assessment_id UUID NOT NULL REFERENCES de_assessments(id) ON DELETE CASCADE,
    alert_category TEXT, -- Core Delivery, People, Operational, Customer, Financial, Compliance
    brief_description TEXT NOT NULL,
    detailed_description TEXT,
    raised_by UUID REFERENCES users(id),
    raised_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_de_assessment_alerts_assessment_id ON de_assessment_alerts(assessment_id);

CREATE TABLE de_assessment_findings (
    id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES de_assessments(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    classification TEXT NOT NULL, -- Observation/Recommendation (legacy) or Governance/Performance/Security/Financial
    description TEXT, -- the finding statement (DE Assessment Workspace)
    severity TEXT, -- Low, Medium, High, Critical
    assigned_to UUID REFERENCES users(id),
    action_taken TEXT,
    finding_date DATE,
    due_date DATE,
    status TEXT NOT NULL, -- Open, In Progress, Awaiting Closure, Closed, Cancelled (+ legacy On Hold/Deferred)
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (assessment_id, sequence_no)
);

CREATE INDEX idx_de_assessment_findings_assessment_id ON de_assessment_findings(assessment_id);

CREATE TRIGGER trg_de_assessment_findings_updated_at BEFORE UPDATE ON de_assessment_findings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
