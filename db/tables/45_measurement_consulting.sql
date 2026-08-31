-- Measurement Entry — Consulting Projects tab (mirrors 11_measurement_development.sql's
-- shape). One snapshot per reporting_periods.id, aligned with Project Status.

CREATE TABLE measurement_consulting (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    planned_effort_as_on_date NUMERIC(14, 2),
    actual_effort_as_on_date NUMERIC(14, 2),
    planned_pct_completion NUMERIC(5, 2),
    actual_pct_completion NUMERIC(5, 2),
    planned_cost NUMERIC(18, 2),
    actual_cost NUMERIC(18, 2),

    -- Computed, read-only in the UI.
    effort_variation_pct NUMERIC(6, 2),
    schedule_performance_index NUMERIC(6, 3),
    cost_performance_index NUMERIC(6, 3),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_measurement_consulting_project_id ON measurement_consulting(project_id, period_id);

CREATE TRIGGER trg_measurement_consulting_updated_at BEFORE UPDATE ON measurement_consulting FOR EACH ROW EXECUTE FUNCTION set_updated_at();
