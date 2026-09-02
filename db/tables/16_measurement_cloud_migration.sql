-- Measurement Entry — Cloud Migration tab (UX §4.10). Event-based, per
-- migration attempt rather than periodic — no uniqueness constraint on
-- (project_id, as_of_date) since multiple attempts can share a date.

CREATE TABLE measurement_cloud_migration (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,

    planned_application_migration_count INTEGER,
    applications_migrated_count INTEGER,
    total_migration_attempts INTEGER,
    successful_migrations INTEGER,
    migration_start_time TIMESTAMPTZ,
    migration_end_time TIMESTAMPTZ,

    -- Computed, read-only in the UI.
    applications_migrated_pct NUMERIC(5, 2),
    migration_success_rate_pct NUMERIC(5, 2),
    migration_downtime_hours NUMERIC(10, 2),

    last_updated_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_measurement_cloud_migration_project_id ON measurement_cloud_migration(project_id, as_of_date DESC);

CREATE TRIGGER trg_measurement_cloud_migration_updated_at BEFORE UPDATE ON measurement_cloud_migration FOR EACH ROW EXECUTE FUNCTION set_updated_at();
