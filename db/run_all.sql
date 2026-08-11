-- Runs every table-creation script in dependency order.
-- Usage: psql -d <database> -f db/run_all.sql   (works from any directory —
-- \ir resolves paths relative to this script's own location, not the cwd)

\ir tables/00_extensions_and_functions.sql
\ir tables/01_reference_data.sql
\ir tables/02_users_roles.sql
\ir tables/03_projects.sql
\ir tables/04_health_declarations.sql
\ir tables/05_project_status_reports.sql
\ir tables/06_risk_log.sql
\ir tables/07_issue_log.sql
\ir tables/08_dependency_log.sql
\ir tables/09_assumption_log.sql
\ir tables/10_opportunity_log.sql
\ir tables/11_measurement_development.sql
\ir tables/12_measurement_support.sql
\ir tables/13_measurement_staffing.sql
\ir tables/14_measurement_testing.sql
\ir tables/15_measurement_cloud_maintenance.sql
\ir tables/16_measurement_cloud_migration.sql
\ir tables/17_contractual_commitments.sql
\ir tables/18_milestone_payments.sql
\ir tables/19_de_assessments.sql
\ir tables/20_data_integrity_checklist.sql
\ir tables/21_integrations.sql
\ir tables/22_audit_activity_log.sql
\ir tables/23_id_sequences.sql
\ir tables/24_metric_target_development.sql
\ir tables/25_metric_target_support.sql
\ir tables/26_metric_target_staffing.sql
\ir tables/27_metric_target_testing.sql
\ir tables/28_metric_target_cloud_maintenance.sql
\ir tables/29_metric_target_cloud_migration.sql
\ir tables/30_ai_field_suggestions.sql
\ir tables/31_ai_row_suggestions.sql
\ir tables/32_project_documents.sql
