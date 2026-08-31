-- Screen-level Action Tracker (design-reference/action-table-design.md,
-- design-reference/Action-Tracker.html): a follow-up-item register scoped to
-- a Geo, Account, or Project, visible from every screen for that entity
-- rather than any one screen/section. `level`+`level_value` is a flat,
-- unconstrained polymorphic pair (no FK — level_value is always the entity's
-- UUID id as text) per the design doc, not the per-level-FK-column pattern
-- this codebase otherwise uses (health_declarations/regional_status) — every
-- Action field is identical regardless of level, so there's nothing
-- level-specific to normalize into separate tables. `overdue` is derived
-- (due_date vs today, not Completed/Closed/Cancelled) rather than stored —
-- see ActionRead.overdue.

CREATE TABLE actions (
    id UUID PRIMARY KEY,
    action_code TEXT UNIQUE NOT NULL,
    level TEXT NOT NULL,            -- GEO, ACCOUNT, PROJECT
    level_value TEXT NOT NULL,      -- the Geo/Account/Project's id, as text

    title TEXT NOT NULL,
    description TEXT,
    action_by_id UUID NOT NULL REFERENCES users(id), -- person responsible (assignee/owner)
    priority TEXT NOT NULL,         -- CRITICAL, HIGH, MEDIUM, LOW
    status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, COMPLETED, CLOSED, CANCELLED

    due_date DATE NOT NULL,
    raised_by UUID NOT NULL REFERENCES users(id),
    raised_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_actions_level_value ON actions(level, level_value);

CREATE TRIGGER trg_actions_updated_at BEFORE UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only audit trail — one row per creation/comment/status-or-field
-- change on an action, per design-reference/action-table-design.md.
CREATE TABLE action_history (
    id UUID PRIMARY KEY,
    action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- CREATED, COMMENT, STATUS_CHANGE, OWNER_CHANGE, DUE_DATE_CHANGE, PRIORITY_CHANGE
    comment TEXT,
    old_value TEXT,
    new_value TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_action_history_action_id ON action_history(action_id);
