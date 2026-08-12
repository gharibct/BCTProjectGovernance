-- Account RAG Status — an account-level equivalent of health_declarations
-- (04_health_declarations.sql), minus the two Project-only "Treatment"
-- fields (Applicable Phase / Project Status), which don't apply to an
-- account. One row per Account Manager re-declaration cycle, keyed off a
-- reporting_periods row, same pattern as project_status_reports.
-- Rating values (all *_rating columns): Red, Potential Red, Amber, Green.

CREATE TABLE account_health_declarations (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    core_delivery_rating TEXT NOT NULL,
    core_delivery_description TEXT,
    people_rating TEXT NOT NULL,
    people_description TEXT,
    operational_rating TEXT NOT NULL,
    operational_description TEXT,
    customer_rating TEXT NOT NULL,
    customer_description TEXT,
    financial_rating TEXT NOT NULL,
    financial_description TEXT,
    compliance_rating TEXT NOT NULL,
    compliance_description TEXT,

    -- Auto-calculated: if any category above is Red, overall is Red.
    overall_rating TEXT NOT NULL,

    declared_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (account_id, period_id)
);

CREATE INDEX idx_account_health_declarations_account_id ON account_health_declarations(account_id, period_id);
