-- Additive migration for an already-deployed DB: a Project Manager can recall a
-- Submitted project status report (back to Draft) until the Delivery Manager
-- approves it. The recall remarks are mandatory and kept on the report until it
-- is resubmitted. Fresh installs get the final shape from
-- db/tables/05_project_status_reports.sql.

ALTER TABLE project_status_reports ADD COLUMN IF NOT EXISTS recall_remarks TEXT;
ALTER TABLE project_status_reports ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ;
