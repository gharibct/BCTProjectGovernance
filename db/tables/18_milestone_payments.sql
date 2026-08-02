-- Contractual Compliance — Milestones Linked to Payment (UX §4.11).
-- Event-based (tied to each milestone's own payment date), so each milestone
-- carries exactly one actual-payment record.

CREATE TABLE milestone_payments (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_name TEXT NOT NULL,
    milestone_description TEXT,
    expected_date_of_payment DATE,
    expected_payment_value NUMERIC(18, 2),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_milestone_payments_project_id ON milestone_payments(project_id);

CREATE TRIGGER trg_milestone_payments_updated_at BEFORE UPDATE ON milestone_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE milestone_payment_actuals (
    id UUID PRIMARY KEY,
    milestone_id UUID NOT NULL UNIQUE REFERENCES milestone_payments(id) ON DELETE CASCADE,
    actual_date_of_payment DATE,
    actual_payment_value NUMERIC(18, 2),
    status TEXT, -- Paid On Time, Delayed Payment, Yet To Be Paid
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_milestone_payment_actuals_updated_at BEFORE UPDATE ON milestone_payment_actuals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
