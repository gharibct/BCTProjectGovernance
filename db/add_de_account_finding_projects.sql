-- Additive migration: optional project codes a DE Account Finding relates to.
-- Idempotent. Fresh installs get this from tables/59_de_account_audits.sql.

ALTER TABLE de_account_findings
    ADD COLUMN IF NOT EXISTS project_ids UUID[] NOT NULL DEFAULT '{}';
