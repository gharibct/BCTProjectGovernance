-- Append-only audit trail of status report submission / review / recall events.
-- One table for all three report levels (report_type: Project, Account, Geo);
-- report_id points at project_status_reports / account_status_reports /
-- geo_status_reports respectively (polymorphic, so no FK on report_id).

CREATE TABLE status_report_history (
    id UUID PRIMARY KEY,
    report_type TEXT NOT NULL, -- Project, Account, Geo
    report_id UUID NOT NULL,
    event_type TEXT NOT NULL, -- Submitted, Recalled, Approved, Rejected, Baselined
    from_status TEXT,
    to_status TEXT NOT NULL,
    comment TEXT, -- recall remarks / review comment
    actor_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_status_report_history_report ON status_report_history(report_type, report_id, created_at);
