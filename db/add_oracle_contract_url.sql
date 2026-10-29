-- Additive migration for an already-deployed DB. Moves the SharePoint documents
-- link from the project (projects.documents_url, "Project Documents") to each
-- mapped Oracle project (project_oracle_ids.contract_url, "Contract Documents"),
-- captured on Link Contract Documents and validated by
-- backend/app/services/sharepoint_link.py (folder name must carry that Oracle ID).
-- An existing project link is carried over to the Oracle mapping(s) its folder
-- name mentions; the rest stay NULL and must be filled before the next submission.
-- Safe to re-run. Fresh installs get the final shape from tables/03_projects.sql.

BEGIN;

ALTER TABLE project_oracle_ids ADD COLUMN IF NOT EXISTS contract_url TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'documents_url'
    ) THEN
        UPDATE project_oracle_ids poi
        SET contract_url = p.documents_url
        FROM projects p
        WHERE p.id = poi.project_id
          AND p.documents_url IS NOT NULL
          AND poi.contract_url IS NULL
          AND position(lower(poi.oracle_project_id) IN lower(p.documents_url)) > 0;

        ALTER TABLE projects DROP COLUMN documents_url;
    END IF;
END $$;

COMMIT;
