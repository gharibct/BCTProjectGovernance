-- Migration for an already-deployed DB. Turns Account Reporting -> Customer
-- Communications into Update Account QBR: reporting_date becomes planned_date,
-- and actual_date, status (QbrStatus) and next_qbr_date are added. Title and
-- presentation are now captured only once a QBR is Conducted. Every existing row
-- was a presentation already shared, so it becomes Conducted with its actual
-- date = the old reporting date (next_qbr_date stays NULL).
-- Safe to re-run. Fresh installs get the final shape from
-- tables/54_account_customer_communications.sql.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'account_customer_communications' AND column_name = 'reporting_date'
    ) THEN
        ALTER TABLE account_customer_communications RENAME COLUMN reporting_date TO planned_date;
    END IF;
END $$;

ALTER TABLE account_customer_communications ADD COLUMN IF NOT EXISTS actual_date DATE;
ALTER TABLE account_customer_communications ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE account_customer_communications ADD COLUMN IF NOT EXISTS next_qbr_date DATE;

UPDATE account_customer_communications
SET status = 'Conducted', actual_date = COALESCE(actual_date, planned_date)
WHERE status IS NULL;

ALTER TABLE account_customer_communications ALTER COLUMN status SET NOT NULL;
ALTER TABLE account_customer_communications ALTER COLUMN title DROP NOT NULL;
ALTER TABLE account_customer_communications ALTER COLUMN file_name DROP NOT NULL;
ALTER TABLE account_customer_communications ALTER COLUMN file_path DROP NOT NULL;

DROP INDEX IF EXISTS idx_account_customer_communications_account;
CREATE INDEX idx_account_customer_communications_account
    ON account_customer_communications(account_id, planned_date DESC);

-- At most one open (Initiated / Scheduled) QBR per account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_customer_communications_open
    ON account_customer_communications(account_id)
    WHERE status IN ('Initiated', 'Scheduled');

COMMIT;
