-- Additive migration for an already-deployed DB. Adds users.password_hash, a
-- nullable local scrypt hash used only when AUTH_TYPE=password. Null means no
-- local password has been set for that user (they can still sign in under
-- AUTH_TYPE=no_password / onelogin). Set one with:
--   python -m scripts.set_password <email-or-ldap-username>
-- or from Admin -> Users & Roles.
-- Safe to run once. Fresh installs get this column from tables/02_users_roles.sql.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMIT;
