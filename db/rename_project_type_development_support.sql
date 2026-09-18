-- Additive migration for an already-deployed DB. Renames the Project Type
-- display names "Development" -> "Development/ Enhancement" and
-- "Support" -> "Support/ Managed Services". `code` (DEVELOPMENT/SUPPORT) is
-- unchanged, so no other table or app logic keyed off the code is affected.
-- Safe to run once. Fresh installs get the final shape from seed_dev.sql /
-- seed_deployment.sql.

BEGIN;

UPDATE project_types SET name = 'Development/ Enhancement' WHERE code = 'DEVELOPMENT';
UPDATE project_types SET name = 'Support/ Managed Services' WHERE code = 'SUPPORT';

COMMIT;
