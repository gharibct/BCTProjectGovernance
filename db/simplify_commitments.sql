-- Additive migration for an already-deployed DB: Contractual Commitments are
-- simplified to Name, Frequency, Penalty Applicability and Commitment Details;
-- Actuals to Date (period_date), Status (met_status) and Actual Details.
-- Formula / Target / Target UOM / Penalty Value are dropped (their data is
-- discarded) and actual_value is renamed actual_details. Safe to rerun.
-- Fresh installs get the final shape from tables/17_contractual_commitments.sql.

ALTER TABLE contractual_commitments ADD COLUMN IF NOT EXISTS commitment_details TEXT;
ALTER TABLE contractual_commitments DROP COLUMN IF EXISTS formula;
ALTER TABLE contractual_commitments DROP COLUMN IF EXISTS target;
ALTER TABLE contractual_commitments DROP COLUMN IF EXISTS target_uom;
ALTER TABLE contractual_commitments DROP COLUMN IF EXISTS penalty_value;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'contractual_commitment_actuals' AND column_name = 'actual_value') THEN
        ALTER TABLE contractual_commitment_actuals RENAME COLUMN actual_value TO actual_details;
    END IF;
END $$;
