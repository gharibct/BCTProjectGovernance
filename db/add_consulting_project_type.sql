-- Adds "Consulting" to the project_types reference table.
-- Safe to re-run: no-ops if the code already exists.
INSERT INTO project_types (id, code, name, description, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'CONSULTING', 'Consulting', NULL, true, now(), now())
ON CONFLICT (code) DO NOTHING;
