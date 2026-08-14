-- RAG Status grids (UX redesign: each category's single free-text
-- description column on health_declarations/account_health_declarations
-- became an individual line-item register instead, mirroring
-- project_status_items/account_status_items exactly — see
-- 35_project_status_items.sql. One row per line item, scoped to a
-- project/account + reporting period + category.
-- category values: Core Delivery, People, Operational, Customer, Financial,
-- Compliance (app.schemas.enums.Category).

CREATE TABLE project_health_items (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_project_health_items_project_period_category ON project_health_items(project_id, period_id, category);

CREATE TRIGGER trg_project_health_items_updated_at BEFORE UPDATE ON project_health_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE account_health_items (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_account_health_items_account_period_category ON account_health_items(account_id, period_id, category);

CREATE TRIGGER trg_account_health_items_updated_at BEFORE UPDATE ON account_health_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
