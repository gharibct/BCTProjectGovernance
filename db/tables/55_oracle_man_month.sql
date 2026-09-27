-- Oracle "BCT Man Month Report" integration. One month of the report (the month
-- before the load date) is loaded into integration_man_month; four tables are
-- then derived from it (see backend/app/services/man_month_import.py,
-- scripts/import_man_month.py):
--   oracle_employee_master           one row per employee
--   oracle_project_master            one row per project
--   oracle_project_allocation        one row per allocation (employee + project +
--                                    allocation start date, with its end date)
--   oracle_project_month_allocation  the man-month of each allocation for a month
-- `month` is the display label ("Aug-26"), `month_start` the same month as a
-- date (2026-08-01) for sorting and joins.
-- Safe to re-run against a live DB: tables are created if missing, new columns
-- are added if missing, and the one destructive step (dropping the OLD
-- oracle_project_allocation, which held monthly man-month sums) only fires while
-- that table still has its old shape. Re-run scripts/import_man_month.py after
-- applying to refill the new columns and tables.

CREATE TABLE IF NOT EXISTS integration_load_run (
    id UUID PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_file TEXT NOT NULL,
    month VARCHAR(6) NOT NULL,
    month_start DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    rows_read INTEGER NOT NULL DEFAULT 0,
    rows_loaded INTEGER NOT NULL DEFAULT 0,
    rows_skipped INTEGER NOT NULL DEFAULT 0,
    employees_inserted INTEGER NOT NULL DEFAULT 0,
    employees_updated INTEGER NOT NULL DEFAULT 0,
    projects_inserted INTEGER NOT NULL DEFAULT 0,
    projects_updated INTEGER NOT NULL DEFAULT 0,
    project_allocations_inserted INTEGER NOT NULL DEFAULT 0,
    project_allocations_updated INTEGER NOT NULL DEFAULT 0,
    -- month allocations (rows of oracle_project_month_allocation)
    allocations_written INTEGER NOT NULL DEFAULT 0,
    allocations_removed INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ
);
ALTER TABLE integration_load_run ADD COLUMN IF NOT EXISTS project_allocations_inserted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE integration_load_run ADD COLUMN IF NOT EXISTS project_allocations_updated INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS integration_man_month (
    id UUID PRIMARY KEY,
    load_run_id UUID NOT NULL REFERENCES integration_load_run(id) ON DELETE CASCADE,
    source_row_no INTEGER NOT NULL,
    month VARCHAR(6) NOT NULL,
    month_start DATE NOT NULL,
    man_month NUMERIC(8, 4),
    employee_geo TEXT,
    operating_unit TEXT,
    account_name TEXT,
    employee_number TEXT NOT NULL,
    name TEXT,
    employment_type TEXT,
    designation TEXT,
    grade TEXT,
    department TEXT,
    doj DATE,
    termination_date DATE,
    location TEXT,
    project_number TEXT NOT NULL,
    project_name TEXT NOT NULL,
    project_type TEXT,
    project_ou TEXT,
    project_geo TEXT,
    project_start_date DATE,
    project_end_date DATE,
    project_sbu_code TEXT,
    project_sbu_name TEXT,
    project_practice TEXT,
    role TEXT,
    percentage_allocation NUMERIC(7, 2),
    allocation_start_date DATE,
    allocation_end_date DATE,
    created_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS employee_geo TEXT;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS operating_unit TEXT;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS doj DATE;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS project_ou TEXT;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS project_sbu_code TEXT;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS project_sbu_name TEXT;
ALTER TABLE integration_man_month ADD COLUMN IF NOT EXISTS project_practice TEXT;

CREATE INDEX IF NOT EXISTS idx_integration_man_month_month ON integration_man_month(month_start);
CREATE INDEX IF NOT EXISTS idx_integration_man_month_employee ON integration_man_month(employee_number);
CREATE INDEX IF NOT EXISTS idx_integration_man_month_project ON integration_man_month(project_number);

CREATE TABLE IF NOT EXISTS oracle_employee_master (
    id UUID PRIMARY KEY,
    employee_number TEXT NOT NULL UNIQUE,
    name TEXT,
    employment_type TEXT,
    designation TEXT,
    grade TEXT,
    department TEXT,
    employee_geo TEXT,
    operating_unit TEXT,
    doj DATE,
    termination_date DATE,
    location TEXT,
    first_seen_month DATE NOT NULL,
    last_seen_month DATE NOT NULL,
    last_load_run_id UUID NOT NULL REFERENCES integration_load_run(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE oracle_employee_master ADD COLUMN IF NOT EXISTS employee_geo TEXT;
ALTER TABLE oracle_employee_master ADD COLUMN IF NOT EXISTS operating_unit TEXT;
ALTER TABLE oracle_employee_master ADD COLUMN IF NOT EXISTS doj DATE;
ALTER TABLE oracle_employee_master ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE oracle_employee_master ADD COLUMN IF NOT EXISTS location TEXT;

CREATE TABLE IF NOT EXISTS oracle_project_master (
    id UUID PRIMARY KEY,
    project_number TEXT NOT NULL UNIQUE,
    project_name TEXT NOT NULL,
    account_name TEXT,
    project_type TEXT,
    project_ou TEXT,
    project_geo TEXT,
    project_start_date DATE,
    project_end_date DATE,
    project_sbu_code TEXT,
    project_sbu_name TEXT,
    project_practice TEXT,
    -- Resolved from project_geo ("BCT US" -> US region -> its GEO) by the import.
    region_id UUID REFERENCES regions(id),
    geo_id UUID REFERENCES geos(id),
    first_seen_month DATE NOT NULL,
    last_seen_month DATE NOT NULL,
    last_load_run_id UUID NOT NULL REFERENCES integration_load_run(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE oracle_project_master ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE oracle_project_master ADD COLUMN IF NOT EXISTS project_ou TEXT;
ALTER TABLE oracle_project_master ADD COLUMN IF NOT EXISTS project_sbu_code TEXT;
ALTER TABLE oracle_project_master ADD COLUMN IF NOT EXISTS project_sbu_name TEXT;
ALTER TABLE oracle_project_master ADD COLUMN IF NOT EXISTS project_practice TEXT;
ALTER TABLE oracle_project_master ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
ALTER TABLE oracle_project_master ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES geos(id);

-- The previous oracle_project_allocation held one man-month sum per employee /
-- project / month. That is now oracle_project_month_allocation; drop the old
-- table (only while it still has the old shape) so the new one can take its name.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'oracle_project_allocation' AND column_name = 'man_month'
    ) THEN
        DROP TABLE oracle_project_allocation CASCADE;
    END IF;
END $$;

-- One row per allocation period. Rows that later disappear from the report stay
-- (history); last_seen_month says when the report last contained them.
CREATE TABLE IF NOT EXISTS oracle_project_allocation (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES oracle_employee_master(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES oracle_project_master(id) ON DELETE CASCADE,
    percentage_allocation NUMERIC(7, 2),
    allocation_start_date DATE NOT NULL,
    allocation_end_date DATE,
    first_seen_month DATE NOT NULL,
    last_seen_month DATE NOT NULL,
    last_load_run_id UUID NOT NULL REFERENCES integration_load_run(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (employee_id, project_id, allocation_start_date)
);

CREATE INDEX IF NOT EXISTS idx_oracle_project_allocation_project ON oracle_project_allocation(project_id);

-- The man-month of one allocation in one month (blank in the report = no row).
CREATE TABLE IF NOT EXISTS oracle_project_month_allocation (
    id UUID PRIMARY KEY,
    allocation_id UUID NOT NULL REFERENCES oracle_project_allocation(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES oracle_employee_master(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES oracle_project_master(id) ON DELETE CASCADE,
    month VARCHAR(6) NOT NULL,
    month_start DATE NOT NULL,
    man_month NUMERIC(8, 4) NOT NULL,
    last_load_run_id UUID NOT NULL REFERENCES integration_load_run(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (allocation_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_oracle_project_month_allocation_month ON oracle_project_month_allocation(month_start);
CREATE INDEX IF NOT EXISTS idx_oracle_project_month_allocation_project ON oracle_project_month_allocation(project_id, month_start);

DROP TRIGGER IF EXISTS trg_oracle_employee_master_updated_at ON oracle_employee_master;
CREATE TRIGGER trg_oracle_employee_master_updated_at BEFORE UPDATE ON oracle_employee_master FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_oracle_project_master_updated_at ON oracle_project_master;
CREATE TRIGGER trg_oracle_project_master_updated_at BEFORE UPDATE ON oracle_project_master FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_oracle_project_allocation_updated_at ON oracle_project_allocation;
CREATE TRIGGER trg_oracle_project_allocation_updated_at BEFORE UPDATE ON oracle_project_allocation FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_oracle_project_month_allocation_updated_at ON oracle_project_month_allocation;
CREATE TRIGGER trg_oracle_project_month_allocation_updated_at BEFORE UPDATE ON oracle_project_month_allocation FOR EACH ROW EXECUTE FUNCTION set_updated_at();
