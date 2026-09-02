-- Additive migration for an already-deployed DB: Amend Approved Project.
-- Safe to run once against a live DB with existing data — creates two new
-- tables only, no drops. Fresh installs get these from
-- tables/48_project_amendments.sql + tables/49_project_amendment_snapshots.sql.

CREATE TABLE IF NOT EXISTS project_amendments (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- In Progress, Submitted, Completed
    initiated_by UUID REFERENCES users(id),
    initiated_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_amendments_project_status ON project_amendments(project_id, status);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_project_amendments_updated_at') THEN
        CREATE TRIGGER trg_project_amendments_updated_at
            BEFORE UPDATE ON project_amendments
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS project_amendment_snapshots (
    id UUID PRIMARY KEY,
    amendment_id UUID NOT NULL REFERENCES project_amendments(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_table TEXT NOT NULL,
    source_row_id UUID,
    row_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_amendment_snapshots_amendment_id ON project_amendment_snapshots(amendment_id);
CREATE INDEX IF NOT EXISTS idx_project_amendment_snapshots_project_id ON project_amendment_snapshots(project_id);
