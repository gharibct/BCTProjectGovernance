-- One-off data fix (2026-09 session). Weekly reporting_periods now run
-- Monday-Friday (5 days) instead of Monday-Sunday (7 days): end_date becomes the
-- Friday, and label shows that Friday ("Sep 11, 2026" for the week Sep 07-11).
-- start_date (Monday), code (ISO week) and the (period_type, start_date) unique
-- key are untouched, so existing reports keep pointing at the same period rows.
-- Safe to re-run: always recomputed from start_date, idempotent.

UPDATE reporting_periods
SET end_date = start_date + 4,
    label = to_char(start_date + 4, 'Mon DD, YYYY')
WHERE period_type = 'Weekly';
