-- Account Reporting / Geo Reporting status grids — mirrors
-- project_status_items (35_project_status_items.sql) exactly, keyed by
-- account_id/geo_id instead of project_id. One row per line item, scoped to
-- an account/geo + reporting period + category.

CREATE TABLE account_status_items (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    category TEXT NOT NULL, -- Key Accomplishments, Upcoming Key Releases / Milestones / Actions, Leadership Support / Attention Required, Key Risks / Issues
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_account_status_items_account_period_category ON account_status_items(account_id, period_id, category);

CREATE TRIGGER trg_account_status_items_updated_at BEFORE UPDATE ON account_status_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE geo_status_items (
    id UUID PRIMARY KEY,
    geo_id UUID NOT NULL REFERENCES geos(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    category TEXT NOT NULL, -- Key Accomplishments, Upcoming Key Releases / Milestones / Actions, Leadership Support / Attention Required, Key Risks / Issues
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_geo_status_items_geo_period_category ON geo_status_items(geo_id, period_id, category);

CREATE TRIGGER trg_geo_status_items_updated_at BEFORE UPDATE ON geo_status_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
