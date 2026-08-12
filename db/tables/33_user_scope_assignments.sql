-- User scope assignments (role rollout for Account Manager / Geo Head / Admin
-- dashboards): which geo(s)/account(s) a user owns, many-to-many since a
-- Geo Head or Account Manager can cover more than one. Drives the pre-
-- filtering on the Geo Head / Account Manager dashboards.
--
-- user_projects is groundwork only for now — a future project roster for
-- Team Member RAID-item assignment scoping; not yet consumed by any
-- dashboard/menu logic.

CREATE TABLE user_geos (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    geo_id UUID NOT NULL REFERENCES geos(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (user_id, geo_id)
);

CREATE INDEX idx_user_geos_user_id ON user_geos(user_id);
CREATE INDEX idx_user_geos_geo_id ON user_geos(geo_id);

CREATE TABLE user_accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (user_id, account_id)
);

CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX idx_user_accounts_account_id ON user_accounts(account_id);

CREATE TABLE user_projects (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (user_id, project_id)
);

CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX idx_user_projects_project_id ON user_projects(project_id);
