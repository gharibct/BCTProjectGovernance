-- Amend Approved Project. One row per amendment cycle for an already-approved
-- project, created by "Initiate Amendment". Drives where Recall and the DE
-- "Return" decision route the project back to (Under Amendment vs Draft).
-- status values: In Progress, Submitted, Completed.

CREATE TABLE project_amendments (
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

CREATE INDEX idx_project_amendments_project_status ON project_amendments(project_id, status);

CREATE TRIGGER trg_project_amendments_updated_at
    BEFORE UPDATE ON project_amendments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
