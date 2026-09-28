-- Additive migration for an already-deployed DB: links a DE assessment to a
-- Weekly reporting period (the same periods Delivery Status reporting uses).
-- Nullable — existing assessments keep NULL. Safe to run more than once. Fresh
-- installs get the column from tables/19_de_assessments.sql.

ALTER TABLE de_assessments ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES reporting_periods(id);
