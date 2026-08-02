-- Project Status (UX requirements §4.4) — weekly narrative status reporting.
-- A project accumulates multiple reports over time (one per week); this holds
-- the full history, not just a "current" record (see §7 items 2-3).

CREATE TABLE project_status_reports (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    key_accomplishments TEXT,
    upcoming_key_releases TEXT,
    leadership_support_required TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, report_date)
);

CREATE INDEX idx_project_status_reports_project_id ON project_status_reports(project_id, report_date DESC);

CREATE TRIGGER trg_project_status_reports_updated_at BEFORE UPDATE ON project_status_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
