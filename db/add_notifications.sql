-- Additive migration for an already-deployed DB: the per-user in-app
-- notification inbox. Safe to run once. Fresh installs get this from
-- tables/51_notifications.sql.

CREATE TABLE IF NOT EXISTS notifications (
    id            UUID PRIMARY KEY,
    recipient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          TEXT NOT NULL,
    title         TEXT NOT NULL,
    body          TEXT,
    link          TEXT,
    entity_type   TEXT,
    entity_id     UUID,
    data          JSONB,
    actor_id      UUID REFERENCES users(id),
    dedupe_key    TEXT,
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe ON notifications(recipient_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;
