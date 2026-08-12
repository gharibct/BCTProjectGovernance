-- Account Reporting / Geo Reporting — manually authored, period-scoped
-- narrative status reports for an Account Manager's account(s) or a Geo
-- Head's geo(s). Mirrors project_status_reports (05_project_status_reports.sql)
-- exactly, just keyed by account_id/geo_id instead of project_id — there is
-- no automatic rollup here, these are written by hand each period.

CREATE TABLE account_status_reports (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Submitted
    -- Key Metrics — captured once per report alongside the narrative tabs.
    revenue NUMERIC(18, 2),
    onsite_fte NUMERIC(5, 2),
    offshore_fte NUMERIC(5, 2),
    projects_count INTEGER,
    key_accomplishments TEXT,
    upcoming_key_releases TEXT,
    leadership_support_required TEXT,
    created_by UUID REFERENCES users(id),
    -- Review/sign-off by the level above (Geo Head) — set once the report
    -- transitions Submitted -> Approved/Rejected.
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (account_id, period_id)
);

CREATE INDEX idx_account_status_reports_account_id ON account_status_reports(account_id, period_id);

CREATE TRIGGER trg_account_status_reports_updated_at BEFORE UPDATE ON account_status_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE geo_status_reports (
    id UUID PRIMARY KEY,
    geo_id UUID NOT NULL REFERENCES geos(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Submitted
    -- Key Metrics — captured once per report alongside the narrative tabs.
    revenue NUMERIC(18, 2),
    onsite_fte NUMERIC(5, 2),
    offshore_fte NUMERIC(5, 2),
    projects_count INTEGER,
    key_accomplishments TEXT,
    upcoming_key_releases TEXT,
    leadership_support_required TEXT,
    created_by UUID REFERENCES users(id),
    -- Review/sign-off by the level above (CXO) — set once the report
    -- transitions Submitted -> Approved/Rejected.
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (geo_id, period_id)
);

CREATE INDEX idx_geo_status_reports_geo_id ON geo_status_reports(geo_id, period_id);

CREATE TRIGGER trg_geo_status_reports_updated_at BEFORE UPDATE ON geo_status_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
