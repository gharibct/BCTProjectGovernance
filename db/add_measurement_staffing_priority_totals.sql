-- Additive migration for an already-deployed DB: switches the per-priority
-- Average Response Time / Lead Time to the requirements-sheet formula
-- (sum of times / count within the period), replacing the old rolling
-- 4-period average of a single entered value.
--
-- New raw inputs: response_time_hours_total + requests_responded_count,
-- lead_time_days_total + associates_onboarded_count. The old
-- response_time_hours / lead_time_days columns are kept (legacy, read-only).
--
-- Backfill: seed each existing row as a one-item period
-- (total = old single value, count = 1) so its avg_* keeps its current
-- displayed value instead of going blank; new periods must enter the real
-- total + count. Guarded by IS NULL so reruns don't double-apply.
--
-- Fresh installs get the final shape from tables/13_measurement_staffing.sql.
-- Safe to run more than once.

ALTER TABLE measurement_staffing_priority_metrics ADD COLUMN IF NOT EXISTS response_time_hours_total NUMERIC(12, 2);
ALTER TABLE measurement_staffing_priority_metrics ADD COLUMN IF NOT EXISTS requests_responded_count INTEGER;
ALTER TABLE measurement_staffing_priority_metrics ADD COLUMN IF NOT EXISTS lead_time_days_total NUMERIC(12, 2);
ALTER TABLE measurement_staffing_priority_metrics ADD COLUMN IF NOT EXISTS associates_onboarded_count INTEGER;

UPDATE measurement_staffing_priority_metrics
SET response_time_hours_total = response_time_hours,
    requests_responded_count = 1
WHERE response_time_hours IS NOT NULL
  AND response_time_hours_total IS NULL
  AND requests_responded_count IS NULL;

UPDATE measurement_staffing_priority_metrics
SET lead_time_days_total = lead_time_days,
    associates_onboarded_count = 1
WHERE lead_time_days IS NOT NULL
  AND lead_time_days_total IS NULL
  AND associates_onboarded_count IS NULL;
