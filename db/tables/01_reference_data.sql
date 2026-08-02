-- Reference/lookup data maintained by Admin (UX requirements §4.15):
-- Organizations, GEOs, Accounts, Project Types.

CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- BCTPL, BCTC, FT
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE geos (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- APAC, MEA, US
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Project Type reference data (Development / Support(Application/Infrastructure) /
-- Professional Staffing / Testing / Cloud Maintenance / Cloud Migration), each with
-- a definition; drives the Project Type dropdown app-wide (UX §4.15).
CREATE TABLE project_types (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    geo_id UUID REFERENCES geos(id),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_accounts_geo_id ON accounts(geo_id);

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_geos_updated_at BEFORE UPDATE ON geos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_project_types_updated_at BEFORE UPDATE ON project_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
