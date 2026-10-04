-- Additive migration for an already-deployed DB:
--   1. Proxy Project Managers (project_proxy_managers) and proxy Delivery Managers
--      (user_accounts.is_proxy). Existing rows are all primary (is_proxy = FALSE).
--   2. Per-project activity restrictions (project_activity_restrictions).
-- Safe to re-run. Fresh installs: db/tables/33, 57 and 58.

ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS project_proxy_managers (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_proxy_managers_project ON project_proxy_managers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_proxy_managers_user ON project_proxy_managers(user_id);

CREATE TABLE IF NOT EXISTS project_activity_restrictions (
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
CREATE INDEX IF NOT EXISTS idx_project_activity_restrictions_project ON project_activity_restrictions(project_id);
