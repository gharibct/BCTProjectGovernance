-- One-off data patch: re-open an APPROVED project status report so the PM can
-- edit it and resubmit. Sets it back to Draft and clears the review sign-off.
--
-- EDIT the three values in the "params" CTE of each statement below (same
-- values in all three places), then run the file.
--   project_code : e.g. 'PRJ-1234'
--   end_date     : the reporting period's end date, e.g. '2026-10-31'
--   period_type  : 'Monthly' or 'Weekly' (a week and a month can share an end date)

-- 1) Preview - must return exactly ONE row
SELECT r.id, p.project_code, rp.period_type, rp.end_date, r.status, r.reviewed_at
FROM project_status_reports r
JOIN projects p ON p.id = r.project_id
JOIN reporting_periods rp ON rp.id = r.period_id
WHERE p.project_code = 'PRJ-1234'
  AND rp.end_date = DATE '2026-10-31'
  AND rp.period_type = 'Monthly';

-- 2) Patch
BEGIN;

UPDATE project_status_reports r
SET status         = 'Draft',
    reviewed_by    = NULL,
    reviewed_at    = NULL,
    review_comment = NULL,
    recall_remarks = 'Re-opened after approval by admin patch to allow data correction.',
    recalled_at    = now()
FROM projects p, reporting_periods rp
WHERE p.id = r.project_id
  AND rp.id = r.period_id
  AND p.project_code = 'PRJ-1234'
  AND rp.end_date = DATE '2026-10-31'
  AND rp.period_type = 'Monthly'
  AND r.status = 'Approved';   -- safety: never touches Draft/Submitted/Rejected

-- Expect "UPDATE 1". If not, ROLLBACK; and recheck the values.
COMMIT;

-- 3) Verify
SELECT r.id, p.project_code, rp.end_date, r.status, r.recalled_at
FROM project_status_reports r
JOIN projects p ON p.id = r.project_id
JOIN reporting_periods rp ON rp.id = r.period_id
WHERE p.project_code = 'PRJ-1234'
  AND rp.end_date = DATE '2026-10-31'
  AND rp.period_type = 'Monthly';
