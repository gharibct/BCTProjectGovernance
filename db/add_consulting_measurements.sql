-- Additive migration for an already-deployed DB: adds measurement_consulting
-- and metric_target_consulting. Safe to run once against a live DB — these
-- are brand-new tables, no existing columns/rows are touched.

CREATE TABLE IF NOT EXISTS measurement_consulting (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    planned_effort_as_on_date NUMERIC(14, 2),
    actual_effort_as_on_date NUMERIC(14, 2),
    planned_pct_completion NUMERIC(5, 2),
    actual_pct_completion NUMERIC(5, 2),
    planned_cost NUMERIC(18, 2),
    actual_cost NUMERIC(18, 2),

    effort_variation_pct NUMERIC(6, 2),
    schedule_performance_index NUMERIC(6, 3),
    cost_performance_index NUMERIC(6, 3),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_measurement_consulting_project_id ON measurement_consulting(project_id, period_id);

DO $$ BEGIN
    CREATE TRIGGER trg_measurement_consulting_updated_at BEFORE UPDATE ON measurement_consulting FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS metric_target_consulting (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_effort_variation_pct NUMERIC(6, 2),
    target_schedule_performance_index NUMERIC(6, 3),
    target_cost_performance_index NUMERIC(6, 3),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

DO $$ BEGIN
    CREATE TRIGGER trg_metric_target_consulting_updated_at BEFORE UPDATE ON metric_target_consulting FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
