-- One-off data fix (2026-09 session). Weekly reporting_periods.label was seeded
-- from start_date ("Sep 07, 2026" for the week ending Sep 13); it should read the
-- period's end date instead ("Sep 13, 2026"), matching a "week ending ..." label.
-- Safe to re-run: always recomputed from end_date, idempotent.

UPDATE reporting_periods
SET label = to_char(end_date, 'Mon DD, YYYY')
WHERE period_type = 'Weekly';
