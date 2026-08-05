-- Metric Targets — Cloud Migration Projects (UX §4.10 "Target Cloud
-- Migration Metrics" tiles). One row per project — no period_id (matches
-- measurement_cloud_migration being event-based rather than periodic).

CREATE TABLE metric_target_cloud_migration (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    target_applications_migrated_pct NUMERIC(5, 2),
    target_migration_success_rate_pct NUMERIC(5, 2),
    target_migration_downtime_minutes NUMERIC(10, 2),

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_metric_target_cloud_migration_updated_at BEFORE UPDATE ON metric_target_cloud_migration FOR EACH ROW EXECUTE FUNCTION set_updated_at();
