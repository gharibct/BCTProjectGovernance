-- Copy the Oracle man-month tables from one database to another on the same
-- PostgreSQL server (SQL alternative to scripts/copy_man_month_tables.py).
--
-- Connect to the TARGET database (e.g. preprod) as a superuser and run this file,
-- after editing the three <...> placeholders below. Ids are kept as-is.
--
-- Copies: integration_load_run, oracle_employee_master, oracle_project_master,
--         integration_man_month, oracle_project_allocation,
--         oracle_project_month_allocation
--
-- The target must have the same schema (same migrations). A plain INSERT is used,
-- so if the target already holds these rows the script fails and rolls back
-- untouched; to overwrite instead, uncomment the TRUNCATE below.
--
-- oracle_project_master.region_id / geo_id are re-resolved in the target by geo
-- code and (geo code, region code), because regions/geos ids differ per database.

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SERVER IF EXISTS src_db CASCADE;
CREATE SERVER src_db FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host '<db host, e.g. 192.168.1.175>', port '5432', dbname '<source database, e.g. Project_Governance_03>');
CREATE USER MAPPING FOR CURRENT_USER SERVER src_db
    OPTIONS (user '<db user>', password '<db password>');

BEGIN;

CREATE SCHEMA src_mm;
IMPORT FOREIGN SCHEMA public
    LIMIT TO (integration_load_run, integration_man_month, oracle_employee_master,
              oracle_project_master, oracle_project_allocation, oracle_project_month_allocation,
              geos, regions)
    FROM SERVER src_db INTO src_mm;

-- TRUNCATE integration_load_run, oracle_employee_master, oracle_project_master,
--          integration_man_month, oracle_project_allocation, oracle_project_month_allocation;

INSERT INTO integration_load_run SELECT * FROM src_mm.integration_load_run;
INSERT INTO oracle_employee_master SELECT * FROM src_mm.oracle_employee_master;

-- Copied by column name with region_id / geo_id blanked, then re-resolved below.
INSERT INTO oracle_project_master
SELECT (json_populate_record(NULL::oracle_project_master,
                             to_jsonb(s) || '{"region_id": null, "geo_id": null}'::jsonb)).*
FROM src_mm.oracle_project_master s;

UPDATE oracle_project_master p
SET geo_id = tg.id,
    region_id = tr.id
FROM src_mm.oracle_project_master s
LEFT JOIN src_mm.geos sg     ON sg.id = s.geo_id
LEFT JOIN geos tg            ON tg.code = sg.code
LEFT JOIN src_mm.regions sr  ON sr.id = s.region_id
LEFT JOIN regions tr         ON tr.geo_id = tg.id AND tr.code = sr.code
WHERE p.id = s.id;

INSERT INTO integration_man_month SELECT * FROM src_mm.integration_man_month;
INSERT INTO oracle_project_allocation SELECT * FROM src_mm.oracle_project_allocation;
INSERT INTO oracle_project_month_allocation SELECT * FROM src_mm.oracle_project_month_allocation;

-- Check: every pair of counts should match, and no project should have lost its region/geo.
SELECT 'integration_load_run' AS tbl, (SELECT count(*) FROM integration_load_run) AS target,
       (SELECT count(*) FROM src_mm.integration_load_run) AS source
UNION ALL SELECT 'oracle_employee_master', (SELECT count(*) FROM oracle_employee_master), (SELECT count(*) FROM src_mm.oracle_employee_master)
UNION ALL SELECT 'oracle_project_master', (SELECT count(*) FROM oracle_project_master), (SELECT count(*) FROM src_mm.oracle_project_master)
UNION ALL SELECT 'integration_man_month', (SELECT count(*) FROM integration_man_month), (SELECT count(*) FROM src_mm.integration_man_month)
UNION ALL SELECT 'oracle_project_allocation', (SELECT count(*) FROM oracle_project_allocation), (SELECT count(*) FROM src_mm.oracle_project_allocation)
UNION ALL SELECT 'oracle_project_month_allocation', (SELECT count(*) FROM oracle_project_month_allocation), (SELECT count(*) FROM src_mm.oracle_project_month_allocation)
UNION ALL SELECT 'projects with region/geo in source but not target',
       (SELECT count(*) FROM oracle_project_master p JOIN src_mm.oracle_project_master s ON s.id = p.id
         WHERE (s.geo_id IS NOT NULL AND p.geo_id IS NULL) OR (s.region_id IS NOT NULL AND p.region_id IS NULL)), 0;

-- Change COMMIT to ROLLBACK for a dry run (the counts above are what would be written).
COMMIT;

DROP SCHEMA IF EXISTS src_mm CASCADE;
DROP SERVER IF EXISTS src_db CASCADE;
