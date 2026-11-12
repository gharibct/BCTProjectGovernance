-- Additive migration for an already-deployed DB: DE Account Allocation
-- (account-level Delivery Excellence audit). Safe to run once against live data;
-- both columns are nullable. Fresh installs get these from tables/02_users_roles.sql.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS delivery_excellence_id UUID REFERENCES users(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS de_allocated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounts_delivery_excellence_id ON accounts(delivery_excellence_id);
