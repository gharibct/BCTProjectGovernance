-- Additive migration for an already-deployed DB: adds the two raw inputs the
-- Code Coverage (Tool Based) metric needs. Optional per the requirements sheet
-- (Mandatory = N); existing rows keep NULL and simply show Code Coverage as
-- "not computed" until re-entered. Fresh installs get these from
-- tables/11_measurement_development.sql. Safe to run more than once.

ALTER TABLE measurement_development ADD COLUMN IF NOT EXISTS covered_code_elements INTEGER;
ALTER TABLE measurement_development ADD COLUMN IF NOT EXISTS total_applicable_code_elements INTEGER;
