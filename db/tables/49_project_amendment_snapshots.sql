-- Pre-amendment value of a single project-data row, captured when an amendment
-- is initiated. One row per snapshotted source row (the projects row plus every
-- module table: oracle ids, resources, commitments, milestone payments, all
-- metric_target_* tables, and the five RAIDO logs). Reference / audit only —
-- no application screen reads this.

CREATE TABLE project_amendment_snapshots (
    id UUID PRIMARY KEY,
    amendment_id UUID NOT NULL REFERENCES project_amendments(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_table TEXT NOT NULL,
    source_row_id UUID,
    row_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_project_amendment_snapshots_amendment_id ON project_amendment_snapshots(amendment_id);
CREATE INDEX idx_project_amendment_snapshots_project_id ON project_amendment_snapshots(project_id);
