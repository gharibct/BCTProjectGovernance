-- Additive migration for an already-deployed DB. Renames the PMO role's display
-- name from "PMO" to "Enablers" (the role code stays PMO). Safe to re-run.
-- Fresh installs get the final value from seed_*.sql. The single source of the
-- label is backend/app/core/labels.py (and frontend/src/lib/role-labels.ts for the UI).

BEGIN;

UPDATE roles
SET name = 'Enablers', description = 'Enablers (formerly Project Management Office)'
WHERE code = 'PMO' AND name = 'PMO';

COMMIT;
