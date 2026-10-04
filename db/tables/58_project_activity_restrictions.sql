-- Per-project activity restrictions: from `not_required_from`, a project no
-- longer owes (or accepts) the given activity. At most one row per project and
-- activity — a restriction is not opened and closed repeatedly. Set by Admin / DE.
--   DELIVERY_STATUS      weekly Delivery Status report (and its RAG)
--   METRICS              monthly Project Performance - Metrics
--   COMMITMENTS          monthly Project Performance - Contractual Commitments
--   PAYMENT_MILESTONES   monthly Project Performance - Payment Milestones
--   DE_ASSESSMENT        DE Assessment (and DE Findings)
-- Report-type activities are restricted for periods starting on/after the date;
-- DE Assessment for assessments dated on/after it.

CREATE TABLE project_activity_restrictions (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    not_required_from DATE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, activity)
);

CREATE INDEX idx_project_activity_restrictions_project ON project_activity_restrictions(project_id);
