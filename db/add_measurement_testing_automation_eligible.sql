-- Additive migration for an already-deployed DB: adds the denominator the
-- requirements sheet specifies for Automation Coverage % (automation-eligible
-- test cases, a subset of total designed). Existing rows keep NULL and show
-- Automation Coverage as "not computed" until re-entered. Fresh installs get
-- this from tables/14_measurement_testing.sql. Safe to run more than once.

ALTER TABLE measurement_testing ADD COLUMN IF NOT EXISTS automation_eligible_test_cases INTEGER;
