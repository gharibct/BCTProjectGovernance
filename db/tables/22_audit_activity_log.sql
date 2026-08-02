-- Audit trail / activity log (Security notes, UX §5 and §4.14: RBAC, MFA,
-- Audit Trail, Activity Logs are explicit requirements).

CREATE TABLE user_activity_log (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_user_activity_log_user_id ON user_activity_log(user_id, created_at DESC);
CREATE INDEX idx_user_activity_log_entity ON user_activity_log(entity_type, entity_id);
