-- Additive migration for an already-deployed DB: adds the products table and
-- wires projects.critical_flag / product_flag / product_id. Safe to run once
-- against a live DB with existing data (no drops; all three columns are
-- nullable so existing project rows are unaffected).

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS critical_flag TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS product_flag TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_projects_product_id ON projects(product_id);
