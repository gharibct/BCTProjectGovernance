-- Local dev seed data for reference lookups (roles, organizations, geos,
-- project types, accounts, a handful of users) so the New Project charter's
-- dropdowns have something to select. Not part of run_all.sql — run
-- separately against a dev database only.

INSERT INTO roles (id, code, name, description) VALUES
    (gen_random_uuid(), 'ADMIN', 'Admin', 'Full system administration'),
    (gen_random_uuid(), 'EXECUTIVE', 'Executive', 'CEO / CDO / GEO Head / Delivery Manager read-mostly access'),
    (gen_random_uuid(), 'PROJECT_MANAGER', 'Project Manager', 'Owns project charter and delivery'),
    (gen_random_uuid(), 'TEAM_MEMBER', 'Team Member', 'Delivery team member'),
    (gen_random_uuid(), 'DELIVERY_EXCELLENCE', 'Delivery Excellence', 'DE assessments and governance'),
    (gen_random_uuid(), 'PMO', 'PMO', 'Project Management Office');

INSERT INTO organizations (id, code, name, is_active, created_at, updated_at) VALUES
    (gen_random_uuid(), 'BCTPL', 'BCT Private Limited', true, now(), now()),
    (gen_random_uuid(), 'BCTC', 'BCT Consulting', true, now(), now()),
    (gen_random_uuid(), 'FT', 'FinTech Unit', true, now(), now());

INSERT INTO geos (id, code, name, is_active, created_at, updated_at) VALUES
    (gen_random_uuid(), 'APAC', 'Asia Pacific', true, now(), now()),
    (gen_random_uuid(), 'MEA', 'Middle East & Africa', true, now(), now()),
    (gen_random_uuid(), 'US', 'United States', true, now(), now());

INSERT INTO project_types (id, code, name, description, is_active, created_at, updated_at) VALUES
    (gen_random_uuid(), 'DEVELOPMENT', 'Development', NULL, true, now(), now()),
    (gen_random_uuid(), 'PROFESSIONAL_STAFFING', 'Professional Staffing', NULL, true, now(), now()),
    (gen_random_uuid(), 'SUPPORT', 'Support', NULL, true, now(), now()),
    (gen_random_uuid(), 'TESTING', 'Testing', NULL, true, now(), now()),
    (gen_random_uuid(), 'CLOUD_MAINTENANCE', 'Cloud Maintenance', NULL, true, now(), now()),
    (gen_random_uuid(), 'CLOUD_MIGRATION', 'Cloud Migration', NULL, true, now(), now());

INSERT INTO accounts (id, name, geo_id, is_active, created_at, updated_at) VALUES
    (gen_random_uuid(), 'Gulf National Bank', (SELECT id FROM geos WHERE code = 'MEA'), true, now(), now()),
    (gen_random_uuid(), 'Pacific Retail Group', (SELECT id FROM geos WHERE code = 'APAC'), true, now(), now()),
    (gen_random_uuid(), 'Liberty Insurance Co', (SELECT id FROM geos WHERE code = 'US'), true, now(), now());

INSERT INTO users (id, ldap_username, full_name, email, role_id, is_active, mfa_enrolled, created_at, updated_at) VALUES
    (gen_random_uuid(), 'hari.g', 'Hari G', 'hari.g@bahwancybertek.com', (SELECT id FROM roles WHERE code = 'PMO'), true, false, now(), now()),
    (gen_random_uuid(), 'rohan.mehta', 'Rohan Mehta', 'rohan.mehta@bahwancybertek.com', (SELECT id FROM roles WHERE code = 'PROJECT_MANAGER'), true, false, now(), now()),
    (gen_random_uuid(), 'ayesha.khan', 'Ayesha Khan', 'ayesha.khan@bahwancybertek.com', (SELECT id FROM roles WHERE code = 'EXECUTIVE'), true, false, now(), now()),
    (gen_random_uuid(), 'daniel.osei', 'Daniel Osei', 'daniel.osei@bahwancybertek.com', (SELECT id FROM roles WHERE code = 'DELIVERY_EXCELLENCE'), true, false, now(), now()),
    (gen_random_uuid(), 'priya.nair', 'Priya Nair', 'priya.nair@bahwancybertek.com', (SELECT id FROM roles WHERE code = 'PROJECT_MANAGER'), true, false, now(), now());

-- Reporting Period lookup (see 01_reference_data.sql) — all ISO weeks/months
-- of 2026 so Measurement and Project Status have periods to report against.
-- Bump the year bounds below when seeding a fresh dev DB in a later year.
INSERT INTO reporting_periods (id, period_type, code, label, start_date, end_date, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Weekly',
       to_char(d, 'IYYY') || '-W' || to_char(d, 'IW'),
       'Week ' || to_char(d, 'IW') || ', ' || to_char(d, 'IYYY'),
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
