-- Metric Targets — Consulting Projects (mirrors 24_metric_target_development.sql's
-- shape). Targets are set once per project, not per reporting period.

CREATE TABLE metric_target_consulting (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_effort_variation_pct NUMERIC(6, 2),
    target_schedule_performance_index NUMERIC(6, 3),
    target_cost_performance_index NUMERIC(6, 3),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_metric_target_consulting_updated_at BEFORE UPDATE ON metric_target_consulting FOR EACH ROW EXECUTE FUNCTION set_updated_at();
