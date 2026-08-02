-- Extensions and shared utility functions used across all Project Governance Tool tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Generic trigger function to keep `updated_at` current on any table that has it.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
