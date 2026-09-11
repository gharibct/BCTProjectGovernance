-- Additive migration for an already-deployed DB: the Project Performance
-- Report's monthly review tracking. Safe to run once (or repeatedly) against
-- a live DB — creates one new table only, no drops. Fresh installs get this
-- from db/tables/52_monthly_report_attestations.sql.

CREATE TABLE IF NOT EXISTS monthly_report_attestations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    page_type TEXT NOT NULL,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id, page_type)
);

CREATE INDEX IF NOT EXISTS idx_monthly_report_attestations_project_period ON monthly_report_attestations(project_id, period_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_monthly_report_attestations_updated_at') THEN
        CREATE TRIGGER trg_monthly_report_attestations_updated_at
            BEFORE UPDATE ON monthly_report_attestations
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;
