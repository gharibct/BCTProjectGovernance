-- Data migration for an already-deployed DB: Geo reports move from the
-- Draft/Submitted/Approved/Rejected review lifecycle to the auto-generated /
-- baseline lifecycle (Auto Generated, Draft - Saved, Baselined). Existing
-- rows are mapped: Draft and Rejected -> Draft - Saved (still editable),
-- Submitted and Approved -> Baselined (frozen). Safe to run once; no schema
-- change (status is free TEXT). Also fix the comment on
-- geo_status_reports.status in db/tables/34_account_geo_status_reports.sql.

UPDATE geo_status_reports SET status = 'Draft - Saved' WHERE status IN ('Draft', 'Rejected');
UPDATE geo_status_reports SET status = 'Baselined' WHERE status IN ('Submitted', 'Approved');
