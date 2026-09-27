-- Additive migration for an already-deployed DB. Renames the ACCOUNT_MANAGER
-- role's display name and the RAID escalation-level value from "Account Manager"
-- to "Delivery Manager" (the role code stays ACCOUNT_MANAGER). Both columns are
-- free text with no CHECK constraint, so plain UPDATEs are enough.
-- Safe to re-run. Fresh installs get the final values from seed_*.sql and the
-- table comments. The single source of the label is backend/app/core/labels.py
-- (and frontend/src/lib/role-labels.ts for the UI).

BEGIN;

UPDATE roles
SET name = 'Delivery Manager'
WHERE code = 'ACCOUNT_MANAGER' AND name = 'Account Manager';

UPDATE issue_log
SET escalation_level = 'Delivery Manager'
WHERE escalation_level = 'Account Manager';

UPDATE dependency_log
SET escalation_level = 'Delivery Manager'
WHERE escalation_level = 'Account Manager';

COMMIT;
