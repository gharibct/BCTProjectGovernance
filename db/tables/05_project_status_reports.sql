-- Project Status (UX requirements §4.4) — weekly and monthly narrative status
-- reporting, keyed off a reporting_periods row (see 01_reference_data.sql).
-- A project accumulates multiple reports over time (one per period); this
-- holds the full history, not just a "current" record (see §7 items 2-3).

CREATE TABLE project_status_reports (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Submitted, Approved, Rejected
    -- Key Metrics — captured once per report alongside the narrative tabs.
    revenue NUMERIC(18, 2),
    onsite_fte NUMERIC(5, 2),
    offshore_fte NUMERIC(5, 2),
    projects_count INTEGER,
    key_accomplishments TEXT,
    upcoming_key_releases TEXT,
    leadership_support_required TEXT,
    created_by UUID REFERENCES users(id),
    -- Review/sign-off by the level above (Account Head/Geo Head/CDO) — set
    -- once the report transitions Submitted -> Approved/Rejected.
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,
    -- Open Alerts snapshot, frozen at save time (as of this period's
    -- end_date) — see db/add_status_report_open_alerts_snapshot.sql.
    open_alerts_count INTEGER NOT NULL DEFAULT 0,
    open_alerts_snapshot JSONB,
    -- Customer Communication — see db/add_status_report_customer_communication.sql.
    customer_report_shared BOOLEAN,
    customer_report_date DATE,
    customer_report_file_name TEXT,
    customer_report_file_path TEXT,
    customer_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_project_status_reports_project_id ON project_status_reports(project_id, period_id);

CREATE TRIGGER trg_project_status_reports_updated_at BEFORE UPDATE ON project_status_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
