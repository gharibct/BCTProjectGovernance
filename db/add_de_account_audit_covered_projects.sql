-- Additive migration: projects covered in a DE Account Audit (Account Assessment > Project Health).
-- Idempotent. Fresh installs get this from tables/59_de_account_audits.sql.

ALTER TABLE de_account_audits
    ADD COLUMN IF NOT EXISTS covered_project_ids UUID[] NOT NULL DEFAULT '{}';
