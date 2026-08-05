-- Metric Targets — Professional Staffing Projects (UX §4.10 "Target
-- Professional Staffing Metrics" tiles). One row per project for the
-- project-level targets, plus a per-priority child table (mirrors
-- measurement_staffing_priority_metrics) for the response/lead time targets
-- that are set per priority bucket rather than for the project as a whole.

CREATE TABLE metric_target_staffing (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_pct_profiles_qualifying NUMERIC(5, 2),
    target_pct_candidates_joining NUMERIC(5, 2),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_metric_target_staffing_updated_at BEFORE UPDATE ON metric_target_staffing FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Response time / lead time targets per request priority (Critical/High/Medium/Low).
CREATE TABLE metric_target_staffing_priority (
    id UUID PRIMARY KEY,
    metric_target_id UUID NOT NULL REFERENCES metric_target_staffing(id) ON DELETE CASCADE,
    priority TEXT NOT NULL, -- Critical, High, Medium, Low
    target_avg_response_time_hours NUMERIC(10, 2),
    target_avg_lead_time_days NUMERIC(10, 2),

    UNIQUE (metric_target_id, priority)
);

CREATE INDEX idx_metric_target_staffing_priority_target_id ON metric_target_staffing_priority(metric_target_id);
