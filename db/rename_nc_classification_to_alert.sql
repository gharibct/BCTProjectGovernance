-- Additive migration for an already-deployed DB. Renames the DE finding
-- classification value "NC" (Non-Conformance) to "Alert". classification is a
-- free-text column with no CHECK constraint, so a plain UPDATE is enough.
-- Safe to run once. Fresh installs get the final shape from
-- tables/19_de_assessments.sql.

BEGIN;

UPDATE de_assessment_findings
SET classification = 'Alert'
WHERE classification = 'NC';

COMMIT;
