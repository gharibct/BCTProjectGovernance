-- Per-user in-app notification inbox. A row is one notification for one
-- recipient; domain events (report reviewed, DE decision, finding raised,
-- action assigned, ...) write rows via app.services.notifications.notify(),
-- and periodic scans (overdue assessment / report defaulter / action due)
-- write rows with a dedupe_key so a repeated scan doesn't re-notify.
-- `data` holds template params for a later email / Teams channel.

CREATE TABLE notifications (
    id            UUID PRIMARY KEY,
    recipient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          TEXT NOT NULL,  -- REPORT_SUBMITTED, REPORT_REVIEWED, DE_DECISION,
                                  -- DE_APPROVAL_QUEUED, FINDING_RAISED, FINDING_STATUS,
                                  -- ACTION_ASSIGNED, ACTION_STATUS, AMENDMENT_INITIATED,
                                  -- ASSESSMENT_OVERDUE, REPORT_DEFAULTER, ACTION_DUE
    title         TEXT NOT NULL,
    body          TEXT,
    link          TEXT,           -- in-app href, e.g. /project-reporting/{id}/dashboard
    entity_type   TEXT,           -- project | status_report | finding | action | amendment
    entity_id     UUID,
    data          JSONB,          -- template params for later email/Teams rendering
    actor_id      UUID REFERENCES users(id),
    dedupe_key    TEXT,           -- set only by scheduled scans (repeat scans no-op)
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX uq_notifications_dedupe ON notifications(recipient_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;
