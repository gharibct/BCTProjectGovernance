-- Measurement Entry — Professional Staffing tab (UX §4.10). Request-driven,
-- rolled up weekly for reporting via reporting_periods.

CREATE TABLE measurement_staffing (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    requests_count INTEGER,
    profiles_submitted_count INTEGER,
    client_interviews_count INTEGER,
    interview_selects_count INTEGER,
    associates_joined_count INTEGER,

    -- Computed, read-only in the UI.
    pct_profiles_qualifying NUMERIC(5, 2),
    pct_candidates_joining NUMERIC(5, 2),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_measurement_staffing_project_id ON measurement_staffing(project_id, period_id);

CREATE TRIGGER trg_measurement_staffing_updated_at BEFORE UPDATE ON measurement_staffing FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Response time (to resource request) and lead time (request to onboarding),
-- tracked per request priority (Critical/High/Medium/Low).
CREATE TABLE measurement_staffing_priority_metrics (
    id UUID PRIMARY KEY,
    measurement_id UUID NOT NULL REFERENCES measurement_staffing(id) ON DELETE CASCADE,
    priority TEXT NOT NULL, -- Critical, High, Medium, Low
    -- Deprecated: single per-period value, superseded by the *_total + count
    -- pair below. Kept for historical rows; not written by new logic.
    response_time_hours NUMERIC(10, 2),
    lead_time_days NUMERIC(10, 2),
    response_time_hours_total NUMERIC(12, 2),
    requests_responded_count INTEGER,
    lead_time_days_total NUMERIC(12, 2),
    associates_onboarded_count INTEGER,
    -- Computed (this period's total / count), read-only in the UI.
    avg_response_time_hours NUMERIC(10, 2),
    avg_lead_time_days NUMERIC(10, 2),

    UNIQUE (measurement_id, priority)
);

CREATE INDEX idx_measurement_staffing_priority_measurement_id ON measurement_staffing_priority_metrics(measurement_id);
