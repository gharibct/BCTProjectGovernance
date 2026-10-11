-- Data patch for an already-deployed DB. Items pulled from a project into an
-- Account report were stored as "<project_code> — <text>"; the code means
-- nothing to end users, so show the project name instead:
--   account_status_items / account_health_items : "<project_name> — <text>"
--   geo_status_items (incl. Auto Generated)     : "<account name> — <project_name> — <text>"
-- Only the project-code segment is rewritten, so any text edited after pulling
-- is kept. Rows are matched through the stored rollup links, not free text.
-- Idempotent (a second run changes 0 rows). It deliberately ignores the
-- Submitted/Approved report freeze: this is a cosmetic label correction.
-- Run once after deploying the code that pulls with the project name.

BEGIN;

-- Geo first: it needs the old account text (with the code) to find its segment.
UPDATE geo_status_items g
SET description = acc.name || ' — ' || pr.project_name || ' — '
                  || substr(g.description, length(acc.name || ' — ' || pr.project_code || ' — ') + 1)
FROM account_status_items ai
JOIN accounts acc ON acc.id = ai.account_id
JOIN project_status_items pi ON pi.rolled_up_account_item_id = ai.id
JOIN projects pr ON pr.id = pi.project_id
WHERE ai.rolled_up_geo_item_id = g.id
  AND left(g.description, length(acc.name || ' — ' || pr.project_code || ' — '))
      = acc.name || ' — ' || pr.project_code || ' — ';

UPDATE account_status_items a
SET description = pr.project_name || ' — ' || substr(a.description, length(pr.project_code || ' — ') + 1)
FROM project_status_items pi
JOIN projects pr ON pr.id = pi.project_id
WHERE pi.rolled_up_account_item_id = a.id
  AND left(a.description, length(pr.project_code || ' — ')) = pr.project_code || ' — ';

UPDATE account_health_items a
SET description = pr.project_name || ' — ' || substr(a.description, length(pr.project_code || ' — ') + 1)
FROM project_health_items pi
JOIN projects pr ON pr.id = pi.project_id
WHERE pi.rolled_up_account_item_id = a.id
  AND left(a.description, length(pr.project_code || ' — ')) = pr.project_code || ' — ';

-- Check: pulled rows still starting with their project's code (expect 0).
SELECT count(*) AS still_with_project_code
FROM account_status_items a
JOIN project_status_items pi ON pi.rolled_up_account_item_id = a.id
JOIN projects pr ON pr.id = pi.project_id
WHERE left(a.description, length(pr.project_code || ' — ')) = pr.project_code || ' — ';

COMMIT;
