-- Measurement Entry — Cloud Maintenance tab (UX §4.10). Uptime tracked
-- continuously, rolled up monthly (SLA-style availability reporting) via reporting_periods.

CREATE TABLE measurement_cloud_maintenance (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),

    total_uptime_hours NUMERIC(10, 2),
    total_scheduled_time_hours NUMERIC(10, 2),
    application_downtime_hours NUMERIC(10, 2),

    -- Computed, read-only in the UI.
    service_availability_pct NUMERIC(5, 2),
    application_availability_pct NUMERIC(5, 2),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    UNIQUE (project_id, period_id)
);

CREATE INDEX idx_measurement_cloud_maintenance_project_id ON measurement_cloud_maintenance(project_id, period_id);

CREATE TRIGGER trg_measurement_cloud_maintenance_updated_at BEFORE UPDATE ON measurement_cloud_maintenance FOR EACH ROW EXECUTE FUNCTION set_updated_at();
