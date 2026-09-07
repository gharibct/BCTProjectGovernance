-- Additive migration for an already-deployed DB: adds the PM "Action Taken
-- Date" and the DE "Closure Date" to the project-level findings register.
-- `action_taken` and `remarks` columns already exist — `remarks` now doubles
-- as the DE's verification remarks captured at closure. Safe to run once
-- against a live DB; no data is touched. Fresh installs get the final shape
-- from tables/19_de_assessments.sql.

ALTER TABLE de_assessment_findings
    ADD COLUMN IF NOT EXISTS action_taken_date DATE;

ALTER TABLE de_assessment_findings
    ADD COLUMN IF NOT EXISTS closure_date DATE;
