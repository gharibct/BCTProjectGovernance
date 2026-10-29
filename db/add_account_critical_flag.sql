-- Additive migration for an already-deployed DB. Adds accounts.critical_flag
-- (Yes / No, set on Admin -> Accounts): Yes = the account owes the customer a
-- QBR every quarter, and only critical accounts are judged on Customer Account
-- Reporting. Existing accounts start as No. Safe to re-run. Fresh installs get
-- the final shape from tables/01_reference_data.sql.

BEGIN;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS critical_flag TEXT NOT NULL DEFAULT 'No';

COMMIT;
