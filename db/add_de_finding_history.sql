-- Additive migration for an already-deployed DB: adds the finding audit trail
-- (de_assessment_finding_history) that backs the "Progress & History" timeline
-- in the DE Findings / DE Assessment Workspace finding drawers. Modelled on
-- action_history (db/tables/44_actions.sql). Safe to run once against a live
-- DB; no existing data is touched. Fresh installs get this from
-- tables/19_de_assessments.sql.

CREATE TABLE IF NOT EXISTS de_assessment_finding_history (
    id UUID PRIMARY KEY,
    finding_id UUID NOT NULL REFERENCES de_assessment_findings(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- CREATED, STATUS_CHANGE, ACTION_TAKEN
    comment TEXT,
    old_value TEXT,
    new_value TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_de_assessment_finding_history_finding_id
    ON de_assessment_finding_history(finding_id, created_at);
