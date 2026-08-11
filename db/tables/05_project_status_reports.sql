-- Project Status (UX requirements §4.4) — weekly and monthly narrative status
-- reporting, keyed off a reporting_periods row (see 01_reference_data.sql).
-- A project accumulates multiple reports over time (one per period); this
-- holds the full history, not just a "current" record (see §7 items 2-3).

CREATE TABLE project_status_reports (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Submitted
    key_accomplishments TEXT,
    upcoming_key_releases TEXT,
    leadership_support_required TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_project_status_reports_project_id ON project_status_reports(project_id, period_id);

CREATE TRIGGER trg_project_status_reports_updated_at BEFORE UPDATE ON project_status_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
