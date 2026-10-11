-- Widens every NUMERIC column that was declared with precision <= 6.
--
-- Why: percentages, indexes and FTE values were declared NUMERIC(5,2) /
-- NUMERIC(6,2) / NUMERIC(6,3), i.e. capped at 999.99 / 9999.99 / 999.999.
-- A derived or entered value above the cap (e.g. Incident SLA compliance =
-- resolved_within_sla / incidents * 100 = 1250) made the INSERT fail with
-- "numeric field overflow" and surfaced as an HTTP 500.
--
--   *_pct, pci_score          NUMERIC(5,2) / NUMERIC(6,2)  -> NUMERIC(12,2)
--   *_performance_index       NUMERIC(6,3)                 -> NUMERIC(12,3)
--   onsite/offshore_fte,
--   project_resources.fte_allocation
--                             NUMERIC(5,2)                 -> NUMERIC(9,2)
--                             (same target as winden_fte_columns.sql)
--
-- Scale is unchanged, so no data is rounded or lost. Widening the precision
-- at the same scale does not rewrite the table in PostgreSQL; each ALTER only
-- takes a brief ACCESS EXCLUSIVE lock. No view, index expression or CHECK
-- constraint references these columns.
--
-- Fresh installs get the final shape from db/tables/*.sql (already updated);
-- this file is for databases created before that change.
-- Idempotent: ALTER ... TYPE to the column's current type is a no-op, so it is
-- safe to run more than once and safe alongside winden_fte_columns.sql.
-- All-or-nothing: one transaction, aborts on the first error.
--
--   psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 -f db/widen_numeric_precision.sql

BEGIN;

-- FTE ------------------------------------------------------------------------
ALTER TABLE project_resources
    ALTER COLUMN fte_allocation TYPE NUMERIC(9, 2);

ALTER TABLE project_status_reports
    ALTER COLUMN onsite_fte TYPE NUMERIC(9, 2),
    ALTER COLUMN offshore_fte TYPE NUMERIC(9, 2);

ALTER TABLE account_status_reports
    ALTER COLUMN onsite_fte TYPE NUMERIC(9, 2),
    ALTER COLUMN offshore_fte TYPE NUMERIC(9, 2);

ALTER TABLE geo_status_reports
    ALTER COLUMN onsite_fte TYPE NUMERIC(9, 2),
    ALTER COLUMN offshore_fte TYPE NUMERIC(9, 2);

-- DE assessment --------------------------------------------------------------
ALTER TABLE de_assessments
    ALTER COLUMN pci_score TYPE NUMERIC(12, 2);

-- Measurements ---------------------------------------------------------------
ALTER TABLE measurement_development
    ALTER COLUMN planned_pct_completion TYPE NUMERIC(12, 2),
    ALTER COLUMN actual_pct_completion TYPE NUMERIC(12, 2),
    ALTER COLUMN effort_variation_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN schedule_performance_index TYPE NUMERIC(12, 3),
    ALTER COLUMN cost_performance_index TYPE NUMERIC(12, 3),
    ALTER COLUMN defect_leakage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN code_coverage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN test_execution_coverage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN test_pass_rate_pct TYPE NUMERIC(12, 2);

ALTER TABLE measurement_support
    ALTER COLUMN incident_sla_compliance_p1_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN incident_sla_compliance_p2_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN incident_sla_compliance_p3_pct TYPE NUMERIC(12, 2);

ALTER TABLE measurement_staffing
    ALTER COLUMN pct_profiles_qualifying TYPE NUMERIC(12, 2),
    ALTER COLUMN pct_candidates_joining TYPE NUMERIC(12, 2);

ALTER TABLE measurement_testing
    ALTER COLUMN test_execution_coverage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN test_pass_rate_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN automation_coverage_pct TYPE NUMERIC(12, 2);

ALTER TABLE measurement_cloud_maintenance
    ALTER COLUMN service_availability_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN application_availability_pct TYPE NUMERIC(12, 2);

ALTER TABLE measurement_cloud_migration
    ALTER COLUMN applications_migrated_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN migration_success_rate_pct TYPE NUMERIC(12, 2);

ALTER TABLE measurement_consulting
    ALTER COLUMN planned_pct_completion TYPE NUMERIC(12, 2),
    ALTER COLUMN actual_pct_completion TYPE NUMERIC(12, 2),
    ALTER COLUMN effort_variation_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN schedule_performance_index TYPE NUMERIC(12, 3),
    ALTER COLUMN cost_performance_index TYPE NUMERIC(12, 3);

-- Metric targets -------------------------------------------------------------
ALTER TABLE metric_target_development
    ALTER COLUMN target_effort_variation_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_schedule_performance_index TYPE NUMERIC(12, 3),
    ALTER COLUMN target_cost_performance_index TYPE NUMERIC(12, 3),
    ALTER COLUMN target_defect_leakage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_code_coverage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_test_execution_coverage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_test_pass_rate_pct TYPE NUMERIC(12, 2);

ALTER TABLE metric_target_support
    ALTER COLUMN target_incident_sla_compliance_p1_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_incident_sla_compliance_p2_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_incident_sla_compliance_p3_pct TYPE NUMERIC(12, 2);

ALTER TABLE metric_target_staffing
    ALTER COLUMN target_pct_profiles_qualifying TYPE NUMERIC(12, 2),
    ALTER COLUMN target_pct_candidates_joining TYPE NUMERIC(12, 2);

ALTER TABLE metric_target_testing
    ALTER COLUMN target_test_execution_coverage_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_test_pass_rate_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_automation_coverage_pct TYPE NUMERIC(12, 2);

ALTER TABLE metric_target_cloud_maintenance
    ALTER COLUMN target_service_availability_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_application_availability_pct TYPE NUMERIC(12, 2);

ALTER TABLE metric_target_cloud_migration
    ALTER COLUMN target_applications_migrated_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_migration_success_rate_pct TYPE NUMERIC(12, 2);

ALTER TABLE metric_target_consulting
    ALTER COLUMN target_effort_variation_pct TYPE NUMERIC(12, 2),
    ALTER COLUMN target_schedule_performance_index TYPE NUMERIC(12, 3),
    ALTER COLUMN target_cost_performance_index TYPE NUMERIC(12, 3);

-- Post-condition: fail (and roll back) if any numeric column in public is
-- still declared with precision <= 6, so a column missed here, or added later
-- with a narrow type, cannot slip through unnoticed.
DO $$
DECLARE
    leftover text;
BEGIN
    SELECT string_agg(table_name || '.' || column_name
                      || ' NUMERIC(' || numeric_precision || ',' || numeric_scale || ')', ', ')
      INTO leftover
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type = 'numeric'
       AND numeric_precision <= 6;

    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION 'widen_numeric_precision: narrow NUMERIC columns remain: %', leftover;
    END IF;
END $$;

COMMIT;
