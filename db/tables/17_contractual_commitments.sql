-- Contractual Compliance — Commitments (UX requirements §4.11). Each
-- commitment defines its own Frequency; actuals are recorded per period at
-- that cadence, so actuals is a history table keyed by period_date.

CREATE TABLE contractual_commitments (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL, -- One Time, Weekly, Fortnight, Monthly, Quarterly, Half Yearly, Phase Wise
    commitment_name TEXT NOT NULL,
    formula TEXT,
    target TEXT,
    penalty_applicable BOOLEAN NOT NULL,
    penalty_value NUMERIC(18, 2),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_contractual_commitments_project_id ON contractual_commitments(project_id);

CREATE TRIGGER trg_contractual_commitments_updated_at BEFORE UPDATE ON contractual_commitments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contractual_commitment_actuals (
    id UUID PRIMARY KEY,
    commitment_id UUID NOT NULL REFERENCES contractual_commitments(id) ON DELETE CASCADE,
    period_date DATE NOT NULL, -- the period this reading covers, per the commitment's Frequency
    actual_value TEXT,
    met_status TEXT, -- Met, Not Met
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (commitment_id, period_date)
);

CREATE INDEX idx_contractual_commitment_actuals_commitment_id ON contractual_commitment_actuals(commitment_id, period_date DESC);
