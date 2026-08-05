-- Metric Targets — Cloud Maintenance Projects (UX §4.10 "Target Cloud
-- Maintenance Metrics" tiles). One row per project — no period_id.

CREATE TABLE metric_target_cloud_maintenance (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_service_availability_pct NUMERIC(5, 2),
    target_application_availability_pct NUMERIC(5, 2),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_metric_target_cloud_maintenance_updated_at BEFORE UPDATE ON metric_target_cloud_maintenance FOR EACH ROW EXECUTE FUNCTION set_updated_at();
