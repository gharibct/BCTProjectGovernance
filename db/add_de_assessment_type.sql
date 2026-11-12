-- Additive migration: assessment type on DE project assessments.
-- Idempotent. Fresh installs get this from tables/19_de_assessments.sql.
-- Existing assessments that already carry a period become Delivery Risk Reviews;
-- the rest are Quality Audits.

ALTER TABLE de_assessments
    ADD COLUMN IF NOT EXISTS assessment_type TEXT NOT NULL DEFAULT 'Quality Audit';

UPDATE de_assessments SET assessment_type = 'Delivery Risk Review'
WHERE period_id IS NOT NULL AND assessment_type = 'Quality Audit';
