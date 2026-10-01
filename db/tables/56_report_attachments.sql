-- Supporting documents attached to a Project or Account status report
-- (Record Project Status / Record Account Status). Many per report. The file is
-- stored on disk under document_storage_dir; only its original name and relative
-- path are kept here. Exactly one of project_report_id / account_report_id is set.

CREATE TABLE report_attachments (
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

CREATE INDEX idx_report_attachments_project ON report_attachments(project_report_id);
CREATE INDEX idx_report_attachments_account ON report_attachments(account_report_id);
