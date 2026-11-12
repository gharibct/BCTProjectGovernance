-- Additive migration: weekly reporting period on DE Account Audit (Account Assessment).
-- Idempotent. Fresh installs get this from tables/59_de_account_audits.sql.
-- Existing rows keep period_id NULL (shown as "—" in the history).

ALTER TABLE de_account_audits
    ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES reporting_periods(id);
