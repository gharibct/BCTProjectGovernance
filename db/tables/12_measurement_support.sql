-- Measurement Entry — Support (Application/Infrastructure) tab (UX §4.10).
-- Continuous/ticket-driven, rolled up weekly for reporting via reporting_periods.

CREATE TABLE measurement_support (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    incidents_p1_count INTEGER,
    incidents_p1_person_days NUMERIC(10, 2),
    incidents_p1_resolved_within_sla_count INTEGER,
    incidents_p2_count INTEGER,
    incidents_p2_person_days NUMERIC(10, 2),
    incidents_p2_resolved_within_sla_count INTEGER,
    incidents_p3_count INTEGER,
    incidents_p3_person_days NUMERIC(10, 2),
    incidents_p3_resolved_within_sla_count INTEGER,
    service_requests_count INTEGER,
    service_requests_total_person_days NUMERIC(10, 2),
    user_clarifications_count INTEGER,
    user_clarifications_total_person_days NUMERIC(10, 2),
    tickets_reopened_count INTEGER,
    aging_tickets_count INTEGER,
    first_time_resolutions_count INTEGER,

    -- Computed, read-only in the UI.
    incident_sla_compliance_p1_pct NUMERIC(5, 2),
    incident_sla_compliance_p2_pct NUMERIC(5, 2),
    incident_sla_compliance_p3_pct NUMERIC(5, 2),
    incident_mttr_p1_hours NUMERIC(10, 2),
    incident_mttr_p2_hours NUMERIC(10, 2),
    incident_mttr_p3_hours NUMERIC(10, 2),
    service_request_mttr_hours NUMERIC(10, 2),
    user_clarification_mttr_hours NUMERIC(10, 2),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_measurement_support_project_id ON measurement_support(project_id, period_id);

CREATE TRIGGER trg_measurement_support_updated_at BEFORE UPDATE ON measurement_support FOR EACH ROW EXECUTE FUNCTION set_updated_at();
