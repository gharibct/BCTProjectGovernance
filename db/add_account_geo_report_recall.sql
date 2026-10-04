-- Additive migration for an already-deployed DB: recall remarks on account and
-- geo status reports (mirrors db/add_status_report_recall.sql). Fresh installs
-- get the final shape from db/tables/34_account_geo_status_reports.sql.

ALTER TABLE account_status_reports ADD COLUMN IF NOT EXISTS recall_remarks TEXT;
ALTER TABLE account_status_reports ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ;
ALTER TABLE geo_status_reports ADD COLUMN IF NOT EXISTS recall_remarks TEXT;
ALTER TABLE geo_status_reports ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ;
