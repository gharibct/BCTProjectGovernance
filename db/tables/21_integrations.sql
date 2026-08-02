-- Admin — Integrations & Reference Data (UX requirements §4.15): external
-- system connections and backup/restore tracking (reference data lookups
-- themselves live in 01_reference_data.sql).

CREATE TABLE integration_connections (
    id UUID PRIMARY KEY,
    integration_name TEXT NOT NULL UNIQUE, -- Microsoft 365, BCT Oracle Application, Ticketing Tools, Project Management Tools
    connection_status TEXT NOT NULL, -- Connected, Error, Not Configured
    last_sync_at TIMESTAMPTZ,
    config JSONB,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER trg_integration_connections_updated_at BEFORE UPDATE ON integration_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE backup_restore_log (
    id UUID PRIMARY KEY,
    action TEXT NOT NULL, -- Backup, Restore
    status TEXT NOT NULL, -- In Progress, Completed, Failed
    triggered_by UUID REFERENCES users(id),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    details TEXT
);

CREATE INDEX idx_backup_restore_log_started_at ON backup_restore_log(started_at DESC);
