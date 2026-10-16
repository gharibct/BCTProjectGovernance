-- Additive migration: submitted_at on the Project / Account / Geo status reports.
-- "Late" is judged from when a report was filed against the reporting period's
-- due_date (reporting_periods.due_date, see db/add_reporting_period_due_date.sql)
-- instead of from the last-edited time. Fresh installs get the final shape from
-- db/tables/05_project_status_reports.sql and db/tables/34_account_geo_status_reports.sql.
-- Safe to re-run: only fills rows that have no submitted_at yet.

ALTER TABLE project_status_reports ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE account_status_reports ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE geo_status_reports     ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Backfill for reports that are already filed. The true submit time was never
-- recorded, so use the best bound available: the last update, or - for an
-- Approved report, whose last update is usually the approval itself - the review
-- time, which can only be later than the submission. Draft / Rejected /
-- Auto Generated reports stay NULL.
UPDATE project_status_reports
SET submitted_at = CASE WHEN status = 'Approved' AND reviewed_at IS NOT NULL
                        THEN LEAST(updated_at, reviewed_at) ELSE updated_at END
WHERE submitted_at IS NULL AND status IN ('Submitted', 'Approved', 'Baselined');

UPDATE account_status_reports
SET submitted_at = CASE WHEN status = 'Approved' AND reviewed_at IS NOT NULL
                        THEN LEAST(updated_at, reviewed_at) ELSE updated_at END
WHERE submitted_at IS NULL AND status IN ('Submitted', 'Approved', 'Baselined');

UPDATE geo_status_reports
SET submitted_at = updated_at
WHERE submitted_at IS NULL AND status IN ('Submitted', 'Approved', 'Baselined');

-- Make sure every period has a due date (Weekly: end + 4 days; Monthly: the 7th
-- of the next month), so the late rule never has to fall back to the end date.
UPDATE reporting_periods SET due_date = end_date + 4
WHERE period_type = 'Weekly' AND due_date IS NULL;

UPDATE reporting_periods SET due_date = (date_trunc('month', end_date) + interval '1 month + 6 days')::date
WHERE period_type = 'Monthly' AND due_date IS NULL;
