-- Proxy Project Managers: extra PMs on a project beyond the Primary one in
-- projects.project_manager_id. Proxies have the same rights as the Primary and
-- are open-ended (no dates). Maintained on the Assign Role screen.
-- Proxy Delivery Managers live in user_accounts (is_proxy = TRUE).

CREATE TABLE project_proxy_managers (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_proxy_managers_project ON project_proxy_managers(project_id);
CREATE INDEX idx_project_proxy_managers_user ON project_proxy_managers(user_id);
