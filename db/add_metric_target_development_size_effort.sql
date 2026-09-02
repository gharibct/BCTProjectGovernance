-- Additive migration for an already-deployed DB: project-level "Size & Effort"
-- planning inputs on the Development metric target (new-project measurement
-- screen, UX §4.10 "Size & Effort"). Safe to run once against a live DB with
-- existing data — every new column is nullable, no drops. Fresh installs get
-- these from tables/24_metric_target_development.sql.

ALTER TABLE metric_target_development ADD COLUMN IF NOT EXISTS target_size_unit TEXT;
ALTER TABLE metric_target_development ADD COLUMN IF NOT EXISTS target_overall_planned_size NUMERIC(14, 2);
ALTER TABLE metric_target_development ADD COLUMN IF NOT EXISTS target_overall_estimated_effort NUMERIC(14, 2);
