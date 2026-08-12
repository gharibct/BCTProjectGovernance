-- Geo RAG Status — a geo-level equivalent of account_health_declarations
-- (37_account_health_declarations.sql), same 6-category taxonomy, keyed off
-- a reporting_periods row. One row per Geo Head re-declaration cycle.
-- Rating values (all *_rating columns): Red, Potential Red, Amber, Green.

CREATE TABLE geo_health_declarations (
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

    -- Auto-calculated: if any category above is Red, overall is Red.
    overall_rating TEXT NOT NULL,

    declared_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (geo_id, period_id)
);

CREATE INDEX idx_geo_health_declarations_geo_id ON geo_health_declarations(geo_id, period_id);
