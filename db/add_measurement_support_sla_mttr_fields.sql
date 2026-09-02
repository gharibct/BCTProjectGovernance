-- Additive migration for an already-deployed DB: wires up the Support metrics
-- that previously always returned NULL and splits the blended Incident MTTR
-- into per-priority values (the requirements sheet reports MTTR "by priority",
-- and the per-priority targets already exist in metric_target_support).
--
--   * incidents_p{1,2,3}_resolved_within_sla_count  -> Incident SLA Compliance %
--   * service_requests_total_person_days            -> Service Request MTTR
--   * user_clarifications_total_person_days         -> User Clarification MTTR
--   * incident_mttr_p{1,2,3}_hours (computed)       -> replace incident_mttr_hours
--
-- No backfill: the new raw inputs are user-entered and the computed MTTR
-- columns are recomputed on the next write. Dropping the blended
-- incident_mttr_hours loses only a derived value that no longer matches the
-- spec. Fresh installs get the final shape from tables/12_measurement_support.sql.
-- Safe to run more than once.

ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS incidents_p1_resolved_within_sla_count INTEGER;
ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS incidents_p2_resolved_within_sla_count INTEGER;
ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS incidents_p3_resolved_within_sla_count INTEGER;
ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS service_requests_total_person_days NUMERIC(10, 2);
ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS user_clarifications_total_person_days NUMERIC(10, 2);

ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS incident_mttr_p1_hours NUMERIC(10, 2);
ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS incident_mttr_p2_hours NUMERIC(10, 2);
ALTER TABLE measurement_support ADD COLUMN IF NOT EXISTS incident_mttr_p3_hours NUMERIC(10, 2);

ALTER TABLE measurement_support DROP COLUMN IF EXISTS incident_mttr_hours;
