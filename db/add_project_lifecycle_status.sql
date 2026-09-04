-- Additive migration for an already-deployed DB. Splits projects.project_status:
-- it keeps only the approval-workflow values (Draft / Pending Approval /
-- Approved / Under Amendment); the lifecycle values move to a new nullable
-- lifecycle_status column (Ongoing / Hold / Closed / Open Only for Billing).
-- Rows that currently hold a lifecycle value in project_status are migrated —
-- the value moves to lifecycle_status and project_status becomes 'Approved'
-- (a lifecycle state only exists on an approved project).
-- Safe to run once. Fresh installs get the final shape from tables/03_projects.sql.

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;

UPDATE projects
SET lifecycle_status = project_status,
    project_status = 'Approved'
WHERE project_status IN ('Ongoing', 'Hold', 'Closed', 'Open Only for Billing');

CREATE INDEX IF NOT EXISTS idx_projects_lifecycle_status ON projects(lifecycle_status);

COMMIT;
