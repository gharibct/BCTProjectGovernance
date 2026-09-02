-- Additive migration for an already-deployed DB: decouples the DE assessment
-- from weekly/monthly reporting periods and from the "one row per project per
-- day" rule. Safe to run once against a live DB with existing data — it only
-- drops a unique constraint, no data is touched. Fresh installs get the
-- constraint-free table from tables/19_de_assessments.sql.

ALTER TABLE de_assessments DROP CONSTRAINT IF EXISTS de_assessments_project_id_assessment_date_key;
