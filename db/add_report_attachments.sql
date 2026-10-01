-- Additive migration for an already-deployed DB: report attachments (Record
-- Project Status / Record Account Status). Fresh installs: db/tables/56_report_attachments.sql.


CREATE TABLE IF NOT EXISTS report_attachments (
    id UUID PRIMARY KEY,
    project_report_id UUID REFERENCES project_status_reports(id) ON DELETE CASCADE,
    account_report_id UUID REFERENCES account_status_reports(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,

    CHECK ((project_report_id IS NOT NULL) <> (account_report_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_report_attachments_project ON report_attachments(project_report_id);
CREATE INDEX IF NOT EXISTS idx_report_attachments_account ON report_attachments(account_report_id);
