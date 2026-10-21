-- Additive migration for an already-deployed DB. Adds users.entra_oid, the
-- immutable Microsoft Entra object ID bound to a user on their first successful
-- Entra sign-in (AUTH_TYPE=entra). Sign-in matches by oid first, then falls back
-- to email/UPN and binds the oid. Null = not yet linked. Admin can clear it to
-- re-link (e.g. after a mailbox/UPN change).
-- Safe to run once. Fresh installs get this column from tables/02_users_roles.sql.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS entra_oid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_entra_oid ON users(entra_oid) WHERE entra_oid IS NOT NULL;

COMMIT;
