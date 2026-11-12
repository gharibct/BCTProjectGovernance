-- DE Account Audit — Delivery Excellence's periodic audit of an ACCOUNT, the
-- account-level counterpart of 19_de_assessments.sql. Independent of the
-- project-level assessment and of reporting periods: any DELIVERY_EXCELLENCE
-- user may audit an account that has a DE allocated (accounts.delivery_excellence_id),
-- as often as needed and at least once per calendar month. audited_by is set
-- from the session. No unique constraint on (account_id, audit_date).

CREATE TABLE de_account_audits (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    audit_date DATE,
    de_assessed_health TEXT NOT NULL, -- Red, Potential Red, Amber, Green
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'Submitted', -- Draft, Submitted
    next_audit_due_date DATE,
    period_id UUID REFERENCES reporting_periods(id), -- weekly period the assessment is aligned with
    covered_project_ids UUID[] NOT NULL DEFAULT '{}', -- projects of the account the DE team covered in this review
    audited_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_de_account_audits_account_id ON de_account_audits(account_id, audit_date DESC);

CREATE TRIGGER trg_de_account_audits_updated_at BEFORE UPDATE ON de_account_audits FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Account-level finding register (mirror of de_assessment_findings), independent
-- of any single audit. The account's Delivery Manager responds with "Action Taken".
CREATE TABLE de_account_findings (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    category TEXT NOT NULL, -- Core Delivery, People, Operational, Customer, Financial, Compliance
    classification TEXT NOT NULL, -- Observation, Recommendation, Alert
    description TEXT,
    action_taken TEXT, -- what the Delivery Manager did
    action_taken_date DATE,
    finding_date DATE,
    due_date DATE,
    status TEXT NOT NULL, -- Open, In Progress, Awaiting Closure, Closed, Cancelled
    remarks TEXT, -- DE verification remarks recorded at closure
    closure_date DATE,
    project_ids UUID[] NOT NULL DEFAULT '{}', -- optional: projects of the account the finding relates to
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (account_id, sequence_no)
);

CREATE INDEX idx_de_account_findings_account_id ON de_account_findings(account_id);

CREATE TRIGGER trg_de_account_findings_updated_at BEFORE UPDATE ON de_account_findings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only audit trail (CREATED, STATUS_CHANGE, ACTION_TAKEN), like de_assessment_finding_history.
CREATE TABLE de_account_finding_history (
    id UUID PRIMARY KEY,
    finding_id UUID NOT NULL REFERENCES de_account_findings(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    comment TEXT,
    old_value TEXT,
    new_value TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_de_account_finding_history_finding_id ON de_account_finding_history(finding_id, created_at);
