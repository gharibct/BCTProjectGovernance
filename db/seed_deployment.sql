-- Minimal bootstrap for a fresh deployment database (new machine, new
-- Postgres instance, no existing data). Run once after db/run_all.sql,
-- against that same database.
--
-- Seeds only what's structurally required before anyone can use the app:
--   - roles: RBAC role codes the backend checks by code (see app/api/deps.py
--     and the per-role menu/permission logic) — the app can't authorize
--     anyone without these rows existing.
--   - reporting_periods: Weekly/Monthly periods drive the period dropdowns
--     on Measurement/Project Status/DE Assessment; Baseline is the sentinel
--     period for each new project's one-time initial Self Assessment.
--   - one Admin user: AUTH_TYPE=no_password logs in by looking up an
--     existing users row by ldap_username/email (see auth.py's /login) —
--     without at least one user, nobody can sign in at all. Admin's sidebar
--     is the union of every other role's, so this account can then create
--     everything else.
--
-- Deliberately NOT seeded here (unlike db/seed_dev.sql, which this was
-- trimmed from): organizations, geos, regions, project types, products,
-- accounts, and any other demo users. Add real values for those through the
-- app once logged in as Admin (Admin screens or the Master Data Excel
-- import/export tool — see backend/scripts/import_master_data.py).

INSERT INTO roles (id, code, name, description) VALUES
    (gen_random_uuid(), 'ADMIN', 'Admin', 'Full system administration'),
    (gen_random_uuid(), 'CXO', 'CXO', 'CEO / CDO / Delivery Manager read-mostly access'),
    (gen_random_uuid(), 'ACCOUNT_MANAGER', 'Account Manager', 'Owns account-level commercial relationship and oversight'),
    (gen_random_uuid(), 'GEO_HEAD', 'Geo Head', 'Read-mostly oversight across projects in their GEO'),
    (gen_random_uuid(), 'PROJECT_MANAGER', 'Project Manager', 'Owns project charter and delivery'),
    (gen_random_uuid(), 'TEAM_MEMBER', 'Team Member', 'Delivery team member'),
    (gen_random_uuid(), 'DELIVERY_EXCELLENCE', 'Delivery Excellence', 'DE assessments and governance'),
    (gen_random_uuid(), 'PMO', 'PMO', 'Project Management Office');

-- One initial Admin login. Change the identifier/email/name below before
-- running against a real deployment if this shouldn't be the first admin.
INSERT INTO users (id, ldap_username, full_name, email, role_id, is_active, mfa_enrolled, created_at, updated_at) VALUES
    (gen_random_uuid(), 'hari.g', 'Hari Hara Sudhan.G', 'hari.g@bahwancybertek.com',
     (SELECT id FROM roles WHERE code = 'ADMIN'), true, false, now(), now());

-- Reporting Period lookup (see db/tables/01_reference_data.sql) — all
-- ISO weeks/months of 2026 so Measurement and Project Status have periods to
-- report against. Extend the year bounds below (or re-run with a later
-- range) as calendar years roll over.
INSERT INTO reporting_periods (id, period_type, code, label, start_date, end_date, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Weekly',
       to_char(d, 'IYYY') || '-W' || to_char(d, 'IW'),
       to_char(d, 'Mon DD, YYYY'),
       d::date, (d::date + 6), true, now(), now()
FROM generate_series('2025-12-29'::date, '2027-01-03'::date, '7 days') AS d;

INSERT INTO reporting_periods (id, period_type, code, label, start_date, end_date, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Monthly',
       to_char(d, 'YYYY-MM'), to_char(d, 'Mon YYYY'),
       d::date, (d::date + interval '1 month - 1 day')::date, true, now(), now()
FROM generate_series('2026-01-01'::date, '2026-12-01'::date, '1 month') AS d;

-- Sentinel "Baseline" period for the New Project wizard's one-time initial
-- Self Assessment (health_declarations.period_id) — it isn't tied to a real
-- calendar period, so start_date is set far in the past purely to sort as
-- the earliest declaration once real Monthly ones exist (see
-- health_declarations.py's _by_period_start).
INSERT INTO reporting_periods (id, period_type, code, label, start_date, end_date, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Baseline', 'BASELINE', 'Baseline', '2000-01-01', '2000-01-01', true, now(), now());
