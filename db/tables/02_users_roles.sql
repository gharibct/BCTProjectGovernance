-- Users & Roles (UX requirements §4.14 Admin — Users & Roles).
-- Auth is LDAP-based (no local password store); MFA enrollment is tracked here.

CREATE TABLE roles (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- ADMIN, EXECUTIVE, PROJECT_MANAGER, TEAM_MEMBER, DELIVERY_EXCELLENCE, PMO
    name TEXT NOT NULL,
    description TEXT
);

-- 'EXECUTIVE' covers the combined CEO / CDO / GEO Head / Delivery Manager
-- read-mostly access group described in UX §2; split into distinct roles later
-- if their permissions diverge.
CREATE TABLE users (
    id UUID PRIMARY KEY,
    ldap_username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role_id UUID NOT NULL REFERENCES roles(id),
    is_active BOOLEAN NOT NULL,
    mfa_enrolled BOOLEAN NOT NULL,
    mfa_enrolled_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
