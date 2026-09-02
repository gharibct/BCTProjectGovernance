-- Additive migration for an already-deployed DB: makes de_assessment_findings a
-- project-level register instead of a child of a single de_assessments row.
-- Findings are re-keyed assessment_id -> project_id, the sequence_no uniqueness
-- moves to (project_id, sequence_no), and assessment_id is dropped entirely.
-- Safe to run once against a live DB with existing data — project_id is
-- backfilled from the parent assessment before the old column is removed.
-- Fresh installs get the final shape from tables/19_de_assessments.sql.

-- 1. New key column, initially nullable so the backfill can populate it.
ALTER TABLE de_assessment_findings
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- 2. Backfill from the parent assessment.
UPDATE de_assessment_findings f
SET project_id = a.project_id
FROM de_assessments a
WHERE a.id = f.assessment_id
  AND f.project_id IS NULL;

-- 3. Renumber sequence_no per project so (project_id, sequence_no) is unique
--    after findings from different assessments of the same project are merged.
--    Order: the finding's own assessment date, then its creation time.
WITH renumbered AS (
    SELECT f.id,
           ROW_NUMBER() OVER (
               PARTITION BY f.project_id
               ORDER BY a.assessment_date NULLS LAST, f.created_at, f.id
           ) AS rn
    FROM de_assessment_findings f
    JOIN de_assessments a ON a.id = f.assessment_id
)
UPDATE de_assessment_findings f
SET sequence_no = renumbered.rn
FROM renumbered
WHERE renumbered.id = f.id;

-- 4. Enforce the new key.
ALTER TABLE de_assessment_findings ALTER COLUMN project_id SET NOT NULL;

ALTER TABLE de_assessment_findings
    DROP CONSTRAINT IF EXISTS de_assessment_findings_assessment_id_sequence_no_key;
ALTER TABLE de_assessment_findings
    ADD CONSTRAINT de_assessment_findings_project_id_sequence_no_key UNIQUE (project_id, sequence_no);

-- 5. Swap the index.
DROP INDEX IF EXISTS idx_de_assessment_findings_assessment_id;
CREATE INDEX IF NOT EXISTS idx_de_assessment_findings_project_id
    ON de_assessment_findings(project_id);

-- 6. Drop the old parent pointer.
ALTER TABLE de_assessment_findings DROP COLUMN IF EXISTS assessment_id;
