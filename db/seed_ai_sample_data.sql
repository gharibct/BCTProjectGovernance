-- =============================================================================
-- Seed sample AI suggestion data for an EXISTING project — not the New
-- Project creation flow, which is what the app's own "Apply AI Results" /
-- "Apply AI Changes" buttons (LoadAiSuggestionsButton / AiRowSuggestionsTrigger)
-- normally seed one screen at a time via the seed-test-data endpoints in
-- backend/app/api/v1/endpoints/ai_suggestions.py and ai_row_suggestions.py.
--
-- This inserts the same canned data directly for all 20 AI-wired screens in
-- one shot, so every screen has review-ready suggestions without navigating
-- to each one and clicking its button. Not part of run_all.sql / seed_dev.sql
-- — this is a manual dev/QA utility, run it yourself when you want it.
--
-- Retarget: edit the three \set lines below.
--   project_id         — defaults to PDO (PRJ-2026-0001)
--   baseline_period_id — the seeded BASELINE sentinel period (project_profile
--                         and scope_schedule always use this one, regardless
--                         of the target project's status)
--   current_period_id  — every other screen (project_status, measurement_*,
--                         de_assessment_profile, the RAID logs, commitments,
--                         milestones, de_assessment_alerts/findings) reads its
--                         period straight from the screen's own URL
--                         (?period=...) with no default, so visit those
--                         screens with ?period=<current_period_id> appended
--                         to see what this script inserts. Defaults to the
--                         current Monthly period (Aug 2026).
--
-- Idempotent:
--   - ai_field_suggestions has UNIQUE(project_id, screen, period_id, field_key)
--     — each block below is an upsert (ON CONFLICT DO UPDATE).
--   - ai_row_suggestions has no such constraint — each block deletes this
--     screen+period's existing pending rows first, matching
--     crud.ai_row_suggestions.replace_pending's own behavior, so re-running
--     resets rather than duplicates.
--
-- Run:
--   psql "postgresql://postgres:postgres@192.168.1.175:5432/Project_Governance_01" \
--        -f db/seed_ai_sample_data.sql
-- =============================================================================

\set project_id '98c57ca2-3d02-4ed1-9bd4-27058313670b'
\set baseline_period_id '0a52181e-63d7-4231-b7d1-abaf9fa2d2ba'
\set current_period_id '0518a9d2-e008-4b4f-9163-4f6374394e6e'

BEGIN;

-- -----------------------------------------------------------------------
-- FIELD SUGGESTIONS (ai_field_suggestions)
-- -----------------------------------------------------------------------

-- project_profile (BASELINE period) — FK fields resolved against whatever
-- reference-data row is "first" for the target project, same as the real
-- endpoint's own _project_profile_test_fields() logic.
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'project_name', 'Digital Field Optimization', 0.96, 'Project_Charter.pdf', 'Page 3', 'The project shall be called Digital Field Optimization.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'engagement_type', 'Implementation', 0.97, 'Project_Charter.pdf', 'Page 3', 'This is an implementation engagement covering full lifecycle delivery.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'contract_type', 'T&M', 0.55, 'Statement_of_Work.docx', 'Section 2', 'Engagement will be billed on a time and materials basis.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'project_owned', 'Co-Owned', 0.4, 'Proposal.pdf', 'Page 1', 'Delivery will be jointly managed with the customer''s PMO.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'project_revenue', '250000', 0.75, 'Commercial_Terms.xlsx', 'Sheet1!B4', 'Total Contract Value: 250,000', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'project_currency', 'USD', 0.9, 'Commercial_Terms.xlsx', 'Sheet1!B5', 'Currency: USD', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'billing_type', 'T&M', 0.5, 'Commercial_Terms.xlsx', 'Sheet1!B6', 'Billing Type: Time & Materials', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'project_type_id', 'f23ef83d-7571-41da-ba9d-df8a28d0ccd7', 0.82, 'Project_Charter.pdf', 'Page 2', 'Project Type: Development', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'organization_id', '7da3ad8c-657a-4a5d-acff-2c771963a4d9', 0.7, 'Project_Charter.pdf', 'Page 1', 'Delivering Organization: BCT Private Limited', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'geo_id', '04821274-abeb-467c-97f7-772b018f25fd', 0.88, 'Project_Charter.pdf', 'Page 1', 'Region: Asia Pacific', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'account_id', '1d12c783-6df4-49e0-bdeb-ace48ee07411', 0.6, 'Project_Charter.pdf', 'Page 1', 'Account: Gulf National Bank', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_profile', :'baseline_period_id'::uuid, 'project_manager_id', '9d651abc-b3f3-442c-a5c2-f2a80c2ad2ac', 0.93, 'Project_Charter.pdf', 'Page 2', 'Project Manager: Hari G', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- scope_schedule (BASELINE period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'scope_schedule', :'baseline_period_id'::uuid, 'customer_overview', 'Global manufacturing client consolidating regional ERP instances into a single cloud platform.', 0.72, 'Statement_of_Work.docx', 'Section 1', 'The customer operates manufacturing sites across three regions and is consolidating regional ERP instances into a single cloud platform.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'scope_schedule', :'baseline_period_id'::uuid, 'project_scope_description', 'Implement and roll out the core ERP modules (Finance, Procurement, Inventory) across all regional sites, including data migration and integration with existing logistics systems.', 0.85, 'Statement_of_Work.docx', 'Section 2', 'Scope covers implementation of Finance, Procurement, and Inventory modules, data migration from legacy systems, and integration with existing logistics systems.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'scope_schedule', :'baseline_period_id'::uuid, 'planned_start_date', '2026-09-01', 0.6, 'Project_Charter.pdf', 'Page 4', 'Project is planned to kick off on September 1, 2026.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'scope_schedule', :'baseline_period_id'::uuid, 'planned_end_date', '2027-03-31', 0.58, 'Project_Charter.pdf', 'Page 4', 'Go-live is targeted for end of March 2027.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- self_assessment (current period — always Monthly, regardless of route)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'core_delivery_rating', 'Amber', 0.74, 'Weekly_Status_Report.pdf', 'Page 1', 'Two milestones slipped by two weeks due to a procurement delay on the client side.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'core_delivery_description', 'Two milestones slipped by two weeks due to procurement delays on the client side.', 0.7, 'Weekly_Status_Report.pdf', 'Page 1', 'Two milestones slipped by two weeks due to a procurement delay on the client side.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'people_rating', 'Green', 0.88, 'Weekly_Status_Report.pdf', 'Page 2', 'Team is fully staffed with no attrition this quarter.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'people_description', 'Team fully staffed with no attrition this quarter.', 0.8, 'Weekly_Status_Report.pdf', 'Page 2', 'Team is fully staffed with no attrition this quarter.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'operational_rating', 'Green', 0.65, 'Weekly_Status_Report.pdf', 'Page 2', 'PO, invoicing, and timesheet compliance are all current.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'operational_description', 'PO, invoicing, and timesheet compliance are all current.', 0.6, 'Weekly_Status_Report.pdf', 'Page 2', 'PO, invoicing, and timesheet compliance are all current.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'customer_rating', 'Amber', 0.55, 'Steering_Committee_Minutes.pdf', 'Page 1', 'Customer raised concerns about response time in the last steering committee.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'customer_description', 'Customer raised concerns about response time in the last steering committee.', 0.55, 'Steering_Committee_Minutes.pdf', 'Page 1', 'Customer raised concerns about response time in the last steering committee.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'financial_rating', 'Green', 0.7, 'Weekly_Status_Report.pdf', 'Page 3', 'Margin is tracking to forecast this period.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'financial_description', 'Margin tracking to forecast.', 0.65, 'Weekly_Status_Report.pdf', 'Page 3', 'Margin is tracking to forecast this period.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'compliance_rating', 'Red', 0.9, 'Risk_Register.xlsx', 'Sheet1!C12', 'Security audit flagged an open vendor access review item, unresolved past due date.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'self_assessment', :'current_period_id'::uuid, 'compliance_description', 'Security audit flagged an open vendor access review item.', 0.85, 'Risk_Register.xlsx', 'Sheet1!C12', 'Security audit flagged an open vendor access review item, unresolved past due date.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- project_status (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'project_status', :'current_period_id'::uuid, 'key_accomplishments', E'• Completed UAT sign-off for Finance module\n• Closed 12 of 15 open defects from last cycle', 0.8, 'Weekly_Status_Report.pdf', 'Page 1', 'UAT for the Finance module was signed off this week; 12 of 15 open defects were closed.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_status', :'current_period_id'::uuid, 'upcoming_key_releases', E'• Go-live for Procurement module targeted next week', 0.68, 'Weekly_Status_Report.pdf', 'Page 1', 'Procurement module go-live is planned for next week pending final approval.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'project_status', :'current_period_id'::uuid, 'leadership_support_required', E'• Vendor hardware procurement delay needs escalation', 0.6, 'Steering_Committee_Minutes.pdf', 'Page 2', 'Vendor hardware procurement is running three weeks behind and needs leadership escalation.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- de_assessment_profile (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'de_assessment_profile', :'current_period_id'::uuid, 'de_assessed_project_health', 'Amber', 0.65, 'Weekly_Status_Report.pdf', 'Page 1', 'Overall project health is trending Amber due to the procurement delay.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'de_assessment_profile', :'current_period_id'::uuid, 'pci_score', '7.5', 0.55, 'Weekly_Status_Report.pdf', 'Page 1', 'Project Compliance Index is calculated at 7.5 this period.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- measurement_development (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_development', :'current_period_id'::uuid, 'overall_planned_size', '450', 0.7, 'Weekly_Status_Report.pdf', 'Page 3', 'Overall planned size is estimated at 450 function points.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_development', :'current_period_id'::uuid, 'actual_pct_completion', '62', 0.65, 'Weekly_Status_Report.pdf', 'Page 3', 'Development is 62% complete as of this reporting period.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_development', :'current_period_id'::uuid, 'uat_defects_external', '4', 0.6, 'Weekly_Status_Report.pdf', 'Page 3', '4 external defects were logged during UAT this period.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- measurement_support (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_support', :'current_period_id'::uuid, 'incidents_p1_count', '2', 0.7, 'Weekly_Status_Report.pdf', 'Page 4', '2 P1 incidents were raised this period.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_support', :'current_period_id'::uuid, 'tickets_reopened_count', '1', 0.55, 'Weekly_Status_Report.pdf', 'Page 4', '1 ticket was reopened after initial resolution.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- measurement_staffing (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_staffing', :'current_period_id'::uuid, 'requests_count', '3', 0.6, 'Resource_Plan.xlsx', 'Sheet1!B2', '3 new staffing requests were raised this period.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_staffing', :'current_period_id'::uuid, 'associates_joined_count', '1', 0.65, 'Resource_Plan.xlsx', 'Sheet1!B5', '1 associate joined the project this period.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- measurement_testing (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_testing', :'current_period_id'::uuid, 'total_test_cases_designed', '220', 0.68, 'Weekly_Status_Report.pdf', 'Page 5', '220 test cases have been designed to date.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_testing', :'current_period_id'::uuid, 'passed_test_cases', '180', 0.6, 'Weekly_Status_Report.pdf', 'Page 5', '180 of the executed test cases passed.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- measurement_cloud_maintenance (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_cloud_maintenance', :'current_period_id'::uuid, 'total_uptime_hours', '710', 0.62, 'Weekly_Status_Report.pdf', 'Page 6', 'Total uptime recorded was 710 hours this period.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_cloud_maintenance', :'current_period_id'::uuid, 'application_downtime_hours', '2', 0.58, 'Weekly_Status_Report.pdf', 'Page 6', 'Application downtime of 2 hours was recorded during a planned maintenance window.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- measurement_cloud_migration (current period)
INSERT INTO ai_field_suggestions
  (id, project_id, screen, period_id, field_key, value, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_cloud_migration', :'current_period_id'::uuid, 'planned_application_migration_count', '12', 0.6, 'Schedule.xlsx', 'Sheet1!C3', '12 applications are planned for migration in this wave.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'measurement_cloud_migration', :'current_period_id'::uuid, 'applications_migrated_count', '9', 0.62, 'Weekly_Status_Report.pdf', 'Page 7', '9 applications have been migrated so far in this wave.', 'pending', now(), now())
ON CONFLICT (project_id, screen, period_id, field_key) DO UPDATE SET
  value = EXCLUDED.value, confidence = EXCLUDED.confidence, source_document = EXCLUDED.source_document,
  source_location = EXCLUDED.source_location, evidence = EXCLUDED.evidence, status = 'pending', updated_at = now();

-- -----------------------------------------------------------------------
-- ROW SUGGESTIONS (ai_row_suggestions) — all current period
-- -----------------------------------------------------------------------

-- risks
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'risks' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'risks', :'current_period_id'::uuid,
   '{"risk_title":"Procurement Delay","risk_category":"Operational","risk_type":"External","probability":"High","impact":"High","response_strategy":"Mitigate","risk_description":"Vendor hardware procurement has been delayed past the planned lead time."}'::jsonb,
   NULL, NULL, 0.87, 'Weekly_Status_Report.pdf', 'Page 2', 'Hardware procurement from the vendor is running three weeks behind the original lead time.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'risks', :'current_period_id'::uuid,
   '{"risk_title":"Vendor Availability","risk_category":"Operational","risk_type":"External","probability":"Medium","impact":"High","response_strategy":"Transfer","risk_description":"Key vendor resource may be unavailable during UAT due to a scheduling conflict."}'::jsonb,
   NULL, NULL, 0.6, 'Resource_Plan.xlsx', 'Sheet1!D8', 'Vendor confirmed the assigned SME has a scheduling conflict during the planned UAT window.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'risks', :'current_period_id'::uuid,
   '{"risk_title":"Cybersecurity Approval","risk_category":"Compliance","risk_type":"Internal","probability":"Medium","impact":"Critical","response_strategy":"Avoid","risk_description":"Security review board has not yet approved the new integration endpoint."}'::jsonb,
   NULL, NULL, 0.4, 'Steering_Committee_Minutes.pdf', 'Page 2', 'Security review board flagged the new integration endpoint as pending approval.', 'pending', now(), now());

-- issues
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'issues' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'issues', :'current_period_id'::uuid,
   '{"issue_title":"Integration Approval Blocked","issue_category":"Compliance","priority":"High","severity":"Major","root_cause":"Security review board has not yet approved the new integration endpoint.","business_impact":"Go-live for the integration module is blocked until approval is granted."}'::jsonb,
   NULL, NULL, 0.66, 'Steering_Committee_Minutes.pdf', 'Page 2', 'Security review board flagged the new integration endpoint as pending approval.', 'pending', now(), now());

-- dependencies
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'dependencies' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'dependencies', :'current_period_id'::uuid,
   '{"dependency_title":"Customer Data Export","dependency_type":"Customer","category":"Data Migration","depends_on":"Customer IT team to provide a clean data export","criticality":"High","probability_of_delay":"Medium","impact_if_delayed":"Data migration testing cannot start without the export."}'::jsonb,
   NULL, NULL, 0.58, 'Statement_of_Work.docx', 'Section 3', 'Migration testing depends on the customer''s IT team providing a clean data export.', 'pending', now(), now());

-- assumptions
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'assumptions' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'assumptions', :'current_period_id'::uuid,
   '{"title":"Existing Infrastructure Reuse","category":"Operational","detailed_description":"Assumes existing customer infrastructure can be reused without upgrades.","probability_of_failure":"Low","impact_rating":"Medium","impact_if_invalid":"Additional infrastructure procurement would extend the schedule."}'::jsonb,
   NULL, NULL, 0.5, 'Project_Charter.pdf', 'Page 5', 'Charter assumes the customer''s existing infrastructure can be reused without upgrades.', 'pending', now(), now());

-- opportunities
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'opportunities' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'opportunities', :'current_period_id'::uuid,
   '{"opportunity_title":"Phase 2 Expansion","category":"Financial","opportunity_description":"Customer expressed interest in extending the engagement to two more regions.","impact":"High","expected_benefit":"Revenue","benefit_type":"Revenue Increase","exploitation_strategy":"Exploit","action_plan":"Prepare a Phase 2 proposal for the additional regions."}'::jsonb,
   NULL, NULL, 0.62, 'Steering_Committee_Minutes.pdf', 'Page 3', 'Customer sponsor expressed interest in extending the engagement to two more regions.', 'pending', now(), now());

-- commitments (no match_key column meaningfully used — always new candidates)
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'commitments' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'commitments', :'current_period_id'::uuid,
   '{"commitment_name":"SLA - Incident Resolution Time","frequency":"Monthly","formula":"Incidents Resolved Within SLA / Total Incidents","target":"95%","penalty_applicable":"Y","penalty_value":"5000"}'::jsonb,
   NULL, NULL, 0.78, 'Statement_of_Work.docx', 'Section 4', 'Vendor shall resolve 95% of logged incidents within the agreed SLA window, measured monthly; failure to meet this target attracts a penalty of $5,000 per occurrence.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'commitments', :'current_period_id'::uuid,
   '{"commitment_name":"System Uptime","frequency":"Monthly","formula":"Uptime Hours / Total Hours","target":"99.5%","penalty_applicable":"Y","penalty_value":"10000"}'::jsonb,
   NULL, NULL, 0.7, 'Purchase_Order.pdf', 'Page 2', 'The platform shall maintain 99.5% uptime measured monthly; non-compliance is subject to a $10,000 service credit.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'commitments', :'current_period_id'::uuid,
   '{"commitment_name":"Monthly Status Reporting","frequency":"Monthly","target":"By 5th of following month","penalty_applicable":"N"}'::jsonb,
   NULL, NULL, 0.5, 'Proposal.pdf', 'Page 6', 'A monthly status report will be submitted to the customer by the 5th of the following month.', 'pending', now(), now());

-- milestones
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'milestones' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'milestones', :'current_period_id'::uuid,
   '{"milestone_name":"Go-Live - Phase 1","expected_date_of_payment":"2026-11-30","expected_payment_value":"150000","milestone_description":"Payment due on successful go-live of Phase 1 (Finance and Procurement modules)."}'::jsonb,
   NULL, NULL, 0.8, 'Purchase_Order.pdf', 'Page 3', '30% of contract value ($150,000) is payable upon successful go-live of Phase 1, covering Finance and Procurement modules.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'milestones', :'current_period_id'::uuid,
   '{"milestone_name":"UAT Sign-off","expected_date_of_payment":"2026-10-15","expected_payment_value":"75000","milestone_description":"Payment due on customer sign-off of User Acceptance Testing."}'::jsonb,
   NULL, NULL, 0.65, 'Proposal.pdf', 'Page 4', '15% of contract value ($75,000) is due upon customer sign-off of User Acceptance Testing, expected mid-October 2026.', 'pending', now(), now()),
  (gen_random_uuid(), :'project_id'::uuid, 'milestones', :'current_period_id'::uuid,
   '{"milestone_name":"Contract Signing Advance","expected_date_of_payment":"2026-09-05","expected_payment_value":"50000"}'::jsonb,
   NULL, NULL, 0.55, 'Purchase_Order.pdf', 'Page 1', 'An advance of $50,000 is payable within 5 business days of contract signing.', 'pending', now(), now());

-- de_assessment_alerts
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'de_assessment_alerts' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'de_assessment_alerts', :'current_period_id'::uuid,
   '{"alert_category":"Compliance","brief_description":"Vendor access review overdue","raised_on":"2026-08-05","detailed_description":"Security audit flagged an open vendor access review item, unresolved past due date."}'::jsonb,
   NULL, NULL, 0.72, 'Risk_Register.xlsx', 'Sheet1!C12', 'Security audit flagged an open vendor access review item, unresolved past due date.', 'pending', now(), now());

-- de_assessment_findings
DELETE FROM ai_row_suggestions WHERE project_id = :'project_id'::uuid AND screen = 'de_assessment_findings' AND period_id = :'current_period_id'::uuid AND status = 'pending';
INSERT INTO ai_row_suggestions
  (id, project_id, screen, period_id, row_values, match_key, matched_entity_id, confidence, source_document, source_location, evidence, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'project_id'::uuid, 'de_assessment_findings', :'current_period_id'::uuid,
   '{"classification":"Observation","action_taken":"Escalated to delivery manager","finding_date":"2026-08-05","status":"Open","remarks":"Procurement delay pending vendor response."}'::jsonb,
   NULL, NULL, 0.6, 'Steering_Committee_Minutes.pdf', 'Page 2', 'Procurement delay was raised in steering committee and escalated to the delivery manager.', 'pending', now(), now());

COMMIT;

-- -----------------------------------------------------------------------
-- Sanity check
-- -----------------------------------------------------------------------
SELECT 'ai_field_suggestions' AS table_name, screen, count(*) AS rows_inserted
FROM ai_field_suggestions
WHERE project_id = :'project_id'::uuid AND status = 'pending'
GROUP BY screen
UNION ALL
SELECT 'ai_row_suggestions', screen, count(*)
FROM ai_row_suggestions
WHERE project_id = :'project_id'::uuid AND status = 'pending'
GROUP BY screen
ORDER BY table_name, screen;
