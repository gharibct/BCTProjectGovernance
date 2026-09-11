-- Project Performance Report — monthly review tracking. A PM must either save
-- data on a section (Measurement / Commitments / Payment Milestones / one of
-- the 5 RAIDO logs) during the Monthly period, or explicitly attest here via
-- "Reviewed and No Changes", before the monthly Submit Report is allowed.

CREATE TABLE monthly_report_attestations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    page_type TEXT NOT NULL, -- MEASUREMENT, COMMITMENTS, PAYMENT_MILESTONES, RISK, ISSUE, DEPENDENCY, ASSUMPTION, OPPORTUNITY
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id, page_type)
);

CREATE INDEX idx_monthly_report_attestations_project_period ON monthly_report_attestations(project_id, period_id);

CREATE TRIGGER trg_monthly_report_attestations_updated_at BEFORE UPDATE ON monthly_report_attestations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
