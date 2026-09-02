-- Measurement Entry — Testing tab (UX §4.10). Per test cycle/phase via reporting_periods.

CREATE TABLE measurement_testing (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    total_test_cases_designed INTEGER,
    executed_test_cases INTEGER,
    passed_test_cases INTEGER,
    automated_test_cases INTEGER,
    automation_eligible_test_cases INTEGER,
    effort_test_case_design NUMERIC(10, 2),
    effort_test_execution NUMERIC(10, 2),

    -- Computed, read-only in the UI.
    test_execution_coverage_pct NUMERIC(5, 2),
    test_pass_rate_pct NUMERIC(5, 2),
    automation_coverage_pct NUMERIC(5, 2),
    test_design_productivity NUMERIC(10, 4),
    test_execution_productivity NUMERIC(10, 4),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_measurement_testing_project_id ON measurement_testing(project_id, period_id);

CREATE TRIGGER trg_measurement_testing_updated_at BEFORE UPDATE ON measurement_testing FOR EACH ROW EXECUTE FUNCTION set_updated_at();
