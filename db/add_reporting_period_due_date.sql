-- Additive migration: adds reporting_periods.due_date and backfills it with the
-- default rule (Weekly: the Tuesday after the Friday end date; Monthly: the 7th
-- of the following month). Safe to re-run; only fills rows that have no due date.

ALTER TABLE reporting_periods ADD COLUMN IF NOT EXISTS due_date DATE;

UPDATE reporting_periods SET due_date = end_date + 4
WHERE period_type = 'Weekly' AND due_date IS NULL;

UPDATE reporting_periods SET due_date = (date_trunc('month', end_date) + interval '1 month + 6 days')::date
WHERE period_type = 'Monthly' AND due_date IS NULL;
