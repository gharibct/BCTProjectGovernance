-- Exchange rates: one row per project currency, giving USD per 1 unit of that
-- currency. Maintained by Admin; used to derive projects.project_revenue_usd.
-- USD itself needs no row (implicitly 1).

CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY,
    currency CHAR(3) NOT NULL UNIQUE,
    rate_to_usd NUMERIC(18, 8) NOT NULL CHECK (rate_to_usd > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
