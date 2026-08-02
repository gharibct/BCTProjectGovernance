-- Data Integrity Checklist (UX requirements §4.13) — a governance rollup, not
-- new source data. This table catalogs the checklist items and each one's
-- expected cadence; the Updated/Not Updated status per project/period is
-- computed at query time from the other module tables (Project Status,
-- Measurement, RAID logs, Health/Status, Contractual), not stored here.

CREATE TABLE data_integrity_checklist_items (
    id UUID PRIMARY KEY,
    module_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    expected_cadence TEXT NOT NULL, -- Weekly, Monthly, Quarterly, Ad Hoc
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE (module_name, item_name)
);
