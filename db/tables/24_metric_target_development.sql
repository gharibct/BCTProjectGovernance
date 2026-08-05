-- Metric Targets — Development Projects (UX §4.10 "Target Development
-- Metrics" tiles). Targets are set once per project, not per reporting
-- period, so this holds one row per project rather than joining through
-- reporting_periods like measurement_development does.

CREATE TABLE metric_target_development (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_productivity NUMERIC(14, 4),
    target_effort_variation_pct NUMERIC(6, 2),
    target_schedule_performance_index NUMERIC(6, 3),
    target_cost_performance_index NUMERIC(6, 3),
    target_defect_leakage_pct NUMERIC(6, 2),
    target_code_coverage_pct NUMERIC(5, 2),
    target_test_execution_coverage_pct NUMERIC(5, 2),
    target_test_pass_rate_pct NUMERIC(5, 2),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_metric_target_development_updated_at BEFORE UPDATE ON metric_target_development FOR EACH ROW EXECUTE FUNCTION set_updated_at();
