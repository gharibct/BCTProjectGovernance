-- Migration for an already-deployed DB. Removes the DE Assessment "Alert
-- Register" feature (de_assessment_alerts) — it is no longer used. Nothing
-- references the table (no inbound FKs); its own FKs point out to
-- de_assessments (CASCADE) and users.
-- Safe to run once. Fresh installs never create the table
-- (tables/19_de_assessments.sql no longer defines it).

BEGIN;

DROP TABLE IF EXISTS de_assessment_alerts;
DELETE FROM id_sequences WHERE entity_code = 'DE_ALERT';

COMMIT;
