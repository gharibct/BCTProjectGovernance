-- Additive migration for an already-deployed DB: Customer Communication on
-- the Project Status screen (Report Project Status -> Project Status) —
-- whether the status report was shared with the customer, when, the uploaded
-- presentation / status report (stored on disk under document_storage_dir;
-- only its original name and relative path are kept here) and optional
-- remarks. Safe to run once; existing rows stay NULL ("not answered").
-- Fresh installs get the final shape from db/tables/05_project_status_reports.sql.

ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS customer_report_shared BOOLEAN;
ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS customer_report_date DATE;
ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS customer_report_file_name TEXT;
ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS customer_report_file_path TEXT;
ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS customer_remarks TEXT;
