-- Additive migration for an already-deployed DB: adds the DE Assessment
-- Workspace fields (design-reference/de-assessments). Safe to run once against a
-- live DB with existing data — no drops; every new column is nullable or has a
-- default, so existing de_assessments / de_assessment_findings rows are
-- unaffected. Fresh installs get these from tables/19_de_assessments.sql.

ALTER TABLE de_assessments ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE de_assessments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Submitted';

ALTER TABLE de_assessment_findings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE de_assessment_findings ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE de_assessment_findings ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);
ALTER TABLE de_assessment_findings ADD COLUMN IF NOT EXISTS due_date DATE;
