-- Additive migration for an already-deployed DB: Migration Downtime moves from
-- minutes to hours, to match the requirements sheet's stated unit
-- (Person-Hours). Touches the measurement table and its target table, which
-- are a matched pair (actual vs target for the same metric) and must move
-- together.
--
-- add-new-column -> backfill-by-converting (/ 60) -> drop-old-column, as three
-- separate idempotent steps. NOT a bare RENAME COLUMN: a rename would leave
-- the minute-valued data sitting under an hours-named column between the
-- rename and the conversion. Each step is guarded (IF NOT EXISTS / WHERE ...
-- IS NULL / IF EXISTS) so reruns are safe.
--
-- This one is NOT safe to run ahead of the matching backend deploy: the old
-- code reads the columns this script drops. Ship them together. Fresh installs
-- get the final shape from tables/16_measurement_cloud_migration.sql and
-- tables/29_metric_target_cloud_migration.sql.

ALTER TABLE measurement_cloud_migration ADD COLUMN IF NOT EXISTS migration_downtime_hours NUMERIC(10, 2);
ALTER TABLE metric_target_cloud_migration ADD COLUMN IF NOT EXISTS target_migration_downtime_hours NUMERIC(10, 2);

UPDATE measurement_cloud_migration
SET migration_downtime_hours = migration_downtime_minutes / 60
WHERE migration_downtime_minutes IS NOT NULL AND migration_downtime_hours IS NULL;

UPDATE metric_target_cloud_migration
SET target_migration_downtime_hours = target_migration_downtime_minutes / 60
WHERE target_migration_downtime_minutes IS NOT NULL AND target_migration_downtime_hours IS NULL;

ALTER TABLE measurement_cloud_migration DROP COLUMN IF EXISTS migration_downtime_minutes;
ALTER TABLE metric_target_cloud_migration DROP COLUMN IF EXISTS target_migration_downtime_minutes;
