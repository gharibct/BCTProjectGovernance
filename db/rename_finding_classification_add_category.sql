-- Additive migration for an already-deployed DB. Splits the finding
-- "classification" concept in two:
--   * classification -> category  (the Project RAG 6-category taxonomy:
--     Core Delivery, People, Operational, Customer, Financial, Compliance)
--   * a new, separate classification column with a small fixed set:
--     Observation, Recommendation, NC (Non-Conformance)
-- Also drops the unused severity column.
-- Safe to run once against a live DB with existing data. Fresh installs get
-- the final shape from tables/19_de_assessments.sql.

BEGIN;

-- 1. The old column held the RAG taxonomy (plus legacy Observation/Recommendation).
--    Rename it to category; the NOT NULL constraint carries over.
ALTER TABLE de_assessment_findings RENAME COLUMN classification TO category;

-- 2. New classification column, populated before it is made NOT NULL.
ALTER TABLE de_assessment_findings ADD COLUMN classification TEXT;

-- 3. Rows that were classified as the legacy Observation/Recommendation keep
--    that as their classification; everything else defaults to NC.
UPDATE de_assessment_findings
SET classification = CASE
    WHEN category IN ('Observation', 'Recommendation') THEN category
    ELSE 'NC'
END;

-- 4. Normalise any category left holding a non-taxonomy value (the legacy
--    Observation/Recommendation rows) to a safe default so category holds
--    only valid Category values.
UPDATE de_assessment_findings
SET category = 'Core Delivery'
WHERE category NOT IN
    ('Core Delivery', 'People', 'Operational', 'Customer', 'Financial', 'Compliance');

-- 5. Enforce NOT NULL on the new column.
ALTER TABLE de_assessment_findings ALTER COLUMN classification SET NOT NULL;

-- 6. Drop the unused severity column.
ALTER TABLE de_assessment_findings DROP COLUMN IF EXISTS severity;

COMMIT;
