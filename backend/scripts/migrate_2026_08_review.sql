-- One-off additive migration for the Project/Account/Geo Review feature
-- (2026-08-12 session). Safe to re-run: every statement is guarded with
-- IF NOT EXISTS. Adds the 3 review columns to the existing report tables
-- and the new geo_health_declarations table — nothing else.

ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_comment TEXT;

ALTER TABLE account_status_reports
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_comment TEXT;

ALTER TABLE geo_status_reports
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_comment TEXT;

CREATE TABLE IF NOT EXISTS geo_health_declarations (
    id UUID PRIMARY KEY,
    geo_id UUID NOT NULL REFERENCES geos(id) ON DELETE CASCADE,
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
    overall_rating TEXT NOT NULL,
    declared_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (geo_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_geo_health_declarations_geo_id ON geo_health_declarations(geo_id, period_id);
