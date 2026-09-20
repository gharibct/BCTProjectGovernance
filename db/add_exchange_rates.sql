-- Additive migration for an already-deployed DB: exchange_rates table +
-- projects.project_revenue_usd (Project Revenue converted to USD).

CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY,
    currency CHAR(3) NOT NULL UNIQUE,
    rate_to_usd NUMERIC(18, 8) NOT NULL CHECK (rate_to_usd > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_revenue_usd NUMERIC(18, 2);

-- Back-fill: USD projects convert 1:1; other currencies stay NULL until Admin
-- enters a rate (saving a rate re-converts every project in that currency).
UPDATE projects SET project_revenue_usd = project_revenue
WHERE project_currency = 'USD' AND project_revenue IS NOT NULL AND project_revenue_usd IS NULL;
