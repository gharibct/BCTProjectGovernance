-- Measurement Entry — Development Projects tab (UX requirements §4.10).
-- One snapshot per reporting_periods.id, aligned with Project Status.

CREATE TABLE measurement_development (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    overall_planned_size NUMERIC(14, 2),
    actual_size NUMERIC(14, 2), -- captured at end of project
    overall_estimated_effort NUMERIC(14, 2),
    planned_effort_as_on_date NUMERIC(14, 2),
    actual_effort_as_on_date NUMERIC(14, 2),
    planned_pct_completion NUMERIC(5, 2),
    actual_pct_completion NUMERIC(5, 2),

    uat_defects_external INTEGER,
    production_defects_external INTEGER,
    total_test_cases_designed INTEGER,
    executed_test_cases INTEGER,
    passed_test_cases INTEGER,
    covered_code_elements INTEGER,
    total_applicable_code_elements INTEGER,

    -- Computed, read-only in the UI.
    productivity NUMERIC(14, 4),
    effort_variation_pct NUMERIC(6, 2),
    schedule_performance_index NUMERIC(6, 3),
    cost_performance_index NUMERIC(6, 3),
    defect_leakage_pct NUMERIC(6, 2),
    code_coverage_pct NUMERIC(5, 2),
    test_execution_coverage_pct NUMERIC(5, 2),
    test_pass_rate_pct NUMERIC(5, 2),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_measurement_development_project_id ON measurement_development(project_id, period_id);

CREATE TRIGGER trg_measurement_development_updated_at BEFORE UPDATE ON measurement_development FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Internal/external defect counts per SDLC stage, one row per stage per
-- measurement period (URD, Proto, SRS, ADD, HLD, USP/LLD, Code, UTC, SITC, UT, SIT).
CREATE TABLE measurement_development_defects (
    id UUID PRIMARY KEY,
    measurement_id UUID NOT NULL REFERENCES measurement_development(id) ON DELETE CASCADE,
    sdlc_stage TEXT NOT NULL, -- URD, Proto, SRS, ADD, HLD, USP/LLD, Code, UTC, SITC, UT, SIT
    internal_defects INTEGER NOT NULL,
    external_defects INTEGER NOT NULL,

    UNIQUE (measurement_id, sdlc_stage)
);

CREATE INDEX idx_measurement_development_defects_measurement_id ON measurement_development_defects(measurement_id);
