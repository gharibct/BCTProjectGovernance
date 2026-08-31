-- Additive migration for an already-deployed DB: adds the regions table and
-- wires projects.region_id to it, plus the 9-row Geo->Region seed. Safe to
-- run once against a live DB with existing data (no drops, region_id is
-- nullable so existing project rows are unaffected).

CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY,
    geo_id UUID NOT NULL REFERENCES geos(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (geo_id, code)
);

CREATE INDEX IF NOT EXISTS idx_regions_geo_id ON regions(geo_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
CREATE INDEX IF NOT EXISTS idx_projects_region_id ON projects(region_id);

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'APAC'), 'BRUNEI', 'Brunei', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'BRUNEI' AND geo_id = (SELECT id FROM geos WHERE code = 'APAC'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'APAC'), 'SINGAPORE', 'Singapore', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'SINGAPORE' AND geo_id = (SELECT id FROM geos WHERE code = 'APAC'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'APAC'), 'INDIA', 'India', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'INDIA' AND geo_id = (SELECT id FROM geos WHERE code = 'APAC'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'US'), 'US', 'United States', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'US' AND geo_id = (SELECT id FROM geos WHERE code = 'US'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'MEA'), 'UAE', 'United Arab Emirates', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'UAE' AND geo_id = (SELECT id FROM geos WHERE code = 'MEA'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'MEA'), 'QATAR', 'Qatar', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'QATAR' AND geo_id = (SELECT id FROM geos WHERE code = 'MEA'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'MEA'), 'UK', 'United Kingdom', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'UK' AND geo_id = (SELECT id FROM geos WHERE code = 'MEA'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'MEA'), 'OMAN', 'Oman', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'OMAN' AND geo_id = (SELECT id FROM geos WHERE code = 'MEA'));

INSERT INTO regions (id, geo_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT id FROM geos WHERE code = 'MEA'), 'SAUDI', 'Saudi Arabia', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE code = 'SAUDI' AND geo_id = (SELECT id FROM geos WHERE code = 'MEA'));
