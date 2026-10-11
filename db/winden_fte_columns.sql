-- widen_fte_columns.sql
BEGIN;

ALTER TABLE account_status_reports
    ALTER COLUMN onsite_fte  TYPE NUMERIC(9, 2),
    ALTER COLUMN offshore_fte TYPE NUMERIC(9, 2);

ALTER TABLE geo_status_reports
    ALTER COLUMN onsite_fte  TYPE NUMERIC(9, 2),
    ALTER COLUMN offshore_fte TYPE NUMERIC(9, 2);

ALTER TABLE project_status_reports
    ALTER COLUMN onsite_fte  TYPE NUMERIC(9, 2),
    ALTER COLUMN offshore_fte TYPE NUMERIC(9, 2);

COMMIT;