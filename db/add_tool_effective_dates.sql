-- Additive migration for an already-deployed DB. Adds "Governance Tool
-- Implementation Effective Date" — the date each Project/Account/Geo started
-- being tracked/reported on in this tool (may differ from a project's actual
-- start date, e.g. an older ongoing project onboarded later). NULL = fall
-- back to existing start-date logic (Project: coalesce(actual_start_date,
-- planned_start_date)) or no restriction (Account/Geo) — see
-- services/reporting_activity.py and services/dashboard.py.
-- Safe to run once. Fresh installs get the final shape from tables/NN_*.sql.

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS tool_effective_date DATE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tool_effective_date DATE;
ALTER TABLE geos ADD COLUMN IF NOT EXISTS tool_effective_date DATE;

COMMIT;
