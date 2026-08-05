-- Metric Targets — Support (Application/Infrastructure) Projects (UX §4.10
-- "Target Support Metrics" tiles). One row per project — no period_id,
-- targets apply across all periods for the project.

CREATE TABLE metric_target_support (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_incident_mttr_p1_hours NUMERIC(10, 2),
    target_incident_mttr_p2_hours NUMERIC(10, 2),
    target_incident_mttr_p3_hours NUMERIC(10, 2),
    target_service_request_mttr_hours NUMERIC(10, 2),
    target_user_clarification_mttr_hours NUMERIC(10, 2),
    target_incident_sla_compliance_p1_pct NUMERIC(5, 2),
    target_incident_sla_compliance_p2_pct NUMERIC(5, 2),
    target_incident_sla_compliance_p3_pct NUMERIC(5, 2),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_metric_target_support_updated_at BEFORE UPDATE ON metric_target_support FOR EACH ROW EXECUTE FUNCTION set_updated_at();
