"""Registry of exclusions and the few cross-cutting mappings the master-data
tooling needs (tables to skip entirely, extra columns to skip beyond the
generic id/created_at/updated_at/computed rules, and the existing
code-generator's entity-code names). See business_keys.py for per-table
lookup-key definitions.
"""

from __future__ import annotations

# Tables never shown as a sheet: pure system/audit/AI-pipeline output, or (for
# executive_updates) a free-form JSONB document authored by a dedicated
# frontend content builder with no reasonable flat-Excel representation.
EXCLUDED_TABLES: frozenset[str] = frozenset(
    {
        "user_activity_log",
        "ai_field_suggestions",
        "ai_row_suggestions",
        "backup_restore_log",
        "id_sequences",
        "project_documents",
        "executive_updates",
        # Action Tracker: a live workflow entity created/updated through the
        # UI (design-reference/action-table-design.md), not master/reference
        # data — action_history is also a pure append-only audit trail, same
        # category as user_activity_log above.
        "actions",
        "action_history",
        # Amend Approved Project: a control row + a pure append-only pre-amend
        # value snapshot, written only by the amendment service — not master data.
        "project_amendments",
        "project_amendment_snapshots",
    }
)

# Columns excluded per table beyond the generic rules (id/created_at/updated_at
# always; any column whose server_default is a FetchedValue, i.e. a true
# Postgres GENERATED ALWAYS column — see introspection._is_computed). These
# have no DB-level marker of their own: they're plain nullable columns that
# application services recompute (measurement metrics, health/status rollup
# caches and pointers) and would silently be overwritten anyway.
EXTRA_EXCLUDED_COLUMNS: dict[str, frozenset[str]] = {
    "projects": frozenset(
        {"delivery_declared_overall_health", "de_assessed_project_health", "overall_project_health"}
    ),
    "health_declarations": frozenset({"overall_rating"}),
    "account_health_declarations": frozenset({"overall_rating"}),
    "geo_health_declarations": frozenset({"overall_rating"}),
    "project_health_items": frozenset({"rolled_up_account_item_id", "account_rollup_status"}),
    "project_status_items": frozenset({"rolled_up_account_item_id", "account_rollup_status"}),
    "account_status_items": frozenset({"rolled_up_geo_item_id", "account_rollup_status"}),
    "measurement_development": frozenset(
        {
            "productivity",
            "effort_variation_pct",
            "schedule_performance_index",
            "cost_performance_index",
            "defect_leakage_pct",
            "code_coverage_pct",
            "test_execution_coverage_pct",
            "test_pass_rate_pct",
        }
    ),
    "measurement_support": frozenset(
        {
            "incident_sla_compliance_p1_pct",
            "incident_sla_compliance_p2_pct",
            "incident_sla_compliance_p3_pct",
            "incident_mttr_p1_hours",
            "incident_mttr_p2_hours",
            "incident_mttr_p3_hours",
            "service_request_mttr_hours",
            "user_clarification_mttr_hours",
        }
    ),
    "measurement_staffing": frozenset({"pct_profiles_qualifying", "pct_candidates_joining"}),
    "measurement_staffing_priority_metrics": frozenset({"avg_response_time_hours", "avg_lead_time_days"}),
    "measurement_testing": frozenset(
        {
            "test_execution_coverage_pct",
            "test_pass_rate_pct",
            "automation_coverage_pct",
            "test_design_productivity",
            "test_execution_productivity",
        }
    ),
    "measurement_cloud_maintenance": frozenset({"service_availability_pct", "application_availability_pct"}),
    "measurement_cloud_migration": frozenset(
        {"applications_migrated_pct", "migration_success_rate_pct", "migration_downtime_hours"}
    ),
    "integration_connections": frozenset({"config"}),
}

# table -> entity_code understood by app.services.code_generator.generate_code().
# Only these tables' business-key column may be left blank on import to have
# a code minted automatically; see business_keys.GENERATED_CODE_COLUMN.
CODE_GENERATOR_ENTITY: dict[str, str] = {
    "projects": "PROJECT",
    "risk_log": "RISK",
    "issue_log": "ISSUE",
    "dependency_log": "DEPENDENCY",
    "assumption_log": "ASSUMPTION",
    "opportunity_log": "OPPORTUNITY",
    "de_assessment_alerts": "DE_ALERT",
}

ALWAYS_EXCLUDED_COLUMNS: frozenset[str] = frozenset({"id", "created_at", "updated_at"})
