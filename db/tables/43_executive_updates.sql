-- Geo Head's Executive Update for CXO — free-form Delivery/People/Financials/
-- Operations content (ExecutiveContentBuilder), replacing the rollup model
-- at the top of the reporting chain. Independent of geo_status_reports
-- (34_account_geo_status_reports.sql) — no submit/review workflow yet,
-- `status` stays 'Draft' this pass (included now so a future submit/review
-- step doesn't need a migration). `content` holds the whole
-- { sections: [...] } document as authored by the frontend — a single
-- document owned and shaped entirely by ExecutiveContentBuilder, not
-- something the backend queries into, so JSONB instead of normalized
-- section/block tables.

CREATE TABLE executive_updates (
    id UUID PRIMARY KEY,
    geo_id UUID NOT NULL REFERENCES geos(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Submitted, Approved, Rejected
    content JSONB NOT NULL DEFAULT '{"sections": []}'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (geo_id, period_id)
);

CREATE INDEX idx_executive_updates_geo_id ON executive_updates(geo_id, period_id);

CREATE TRIGGER trg_executive_updates_updated_at BEFORE UPDATE ON executive_updates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
