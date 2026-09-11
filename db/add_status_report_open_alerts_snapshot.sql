-- Additive migration for an already-deployed DB: adds the Open Alerts
-- snapshot (count + row detail, frozen at save time as of the reporting
-- period's end_date) to the 3 period-scoped status report tables backing
-- Project Weekly/Monthly, Account and Geo Reporting. Safe to run once
-- against a live DB — every existing row defaults to a 0/empty snapshot,
-- which is corrected the next time that report is saved. Fresh installs get
-- the final shape from db/tables/05_project_status_reports.sql and
-- db/tables/34_account_geo_status_reports.sql.

ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS open_alerts_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_status_reports
    ADD COLUMN IF NOT EXISTS open_alerts_snapshot JSONB;

ALTER TABLE account_status_reports
    ADD COLUMN IF NOT EXISTS open_alerts_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE account_status_reports
    ADD COLUMN IF NOT EXISTS open_alerts_snapshot JSONB;

ALTER TABLE geo_status_reports
    ADD COLUMN IF NOT EXISTS open_alerts_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE geo_status_reports
    ADD COLUMN IF NOT EXISTS open_alerts_snapshot JSONB;
