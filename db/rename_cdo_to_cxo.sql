-- Additive migration for an already-deployed DB. Renames the CDO role to CXO
-- (CEO, CDO, CHRO and other C-level executives). roles.code is free text, and
-- users reference roles by id, so plain UPDATEs are enough. Safe to re-run.
-- Fresh installs get the final values from seed_*.sql.

BEGIN;

UPDATE roles
SET code = 'CXO',
    name = 'CXO',
    description = 'CXO (CEO, CDO, CHRO and other C-level executives) read-mostly access'
WHERE code = 'CDO';

UPDATE users
SET ldap_username = 'cxo', full_name = 'CXO', email = 'cxo@bahwancybertek.com'
WHERE ldap_username = 'cdo';

COMMIT;
