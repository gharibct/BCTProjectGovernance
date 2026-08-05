-- Metric Targets — Testing Projects (UX §4.10 "Target Testing Metrics"
-- tiles). One row per project — no period_id.

CREATE TABLE metric_target_testing (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_test_execution_coverage_pct NUMERIC(5, 2),
    target_test_pass_rate_pct NUMERIC(5, 2),
    target_automation_coverage_pct NUMERIC(5, 2),
    target_test_design_productivity NUMERIC(10, 4),
    target_test_execution_productivity NUMERIC(10, 4),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_metric_target_testing_updated_at BEFORE UPDATE ON metric_target_testing FOR EACH ROW EXECUTE FUNCTION set_updated_at();
