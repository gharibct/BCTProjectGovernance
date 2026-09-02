"""Per-table business-key definitions used to look tables up by a
human-readable value instead of their raw UUID id — both when the
master-data sheet needs to render a foreign key column, and when the
importer needs to decide whether a row is an insert or an update.

A key is a tuple of parts:
  - Local(column): a plain column on the table itself.
  - Ref(fk_column): one of the table's own FK columns, standing in for
    *that target table's own* business key, which may itself contain Local
    and/or Ref parts. app.master_data.introspection.resolve_key_parts()
    walks these recursively down to physically real columns; the importer's
    resolve_id() does the same walk over actual cell values.

Tables absent from BUSINESS_KEYS have no natural (or practical) unique
lookup key at all — every row the importer sees for them is always a fresh
insert, matching how they're used in the app itself (free-form, add-only
line-item registers with no edit-by-key affordance): project_health_items,
project_status_items, account_status_items, geo_status_items,
account_health_items, measurement_cloud_migration (whose own docstring says
multiple attempts per date are allowed by design).

A few keys (project_resources, milestone_payments, contractual_commitments)
are *practical* rather than DB-enforced — there is no actual UNIQUE
constraint backing them, so the importer reports a clear error rather than
guessing if it finds more than one existing row matching a given key.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Local:
    column: str


@dataclass(frozen=True)
class Ref:
    fk_column: str


KeyPart = Local | Ref

BUSINESS_KEYS: dict[str, tuple[KeyPart, ...]] = {
    "roles": (Local("code"),),
    "users": (Local("email"),),
    "user_geos": (Ref("user_id"), Ref("geo_id")),
    "user_accounts": (Ref("user_id"), Ref("account_id")),
    "user_projects": (Ref("user_id"), Ref("project_id")),
    "organizations": (Local("code"),),
    "geos": (Local("code"),),
    "regions": (Ref("geo_id"), Local("code")),
    "project_types": (Local("code"),),
    "products": (Local("code"),),
    "accounts": (Local("name"),),
    "reporting_periods": (Local("code"),),
    "projects": (Local("project_code"),),
    "project_oracle_ids": (Ref("project_id"), Local("oracle_project_id")),
    "project_resources": (Ref("project_id"), Local("resource_name")),  # practical, not DB-unique
    "risk_log": (Local("risk_code"),),
    "issue_log": (Local("issue_code"),),
    "dependency_log": (Local("dependency_code"),),
    "assumption_log": (Local("assumption_code"),),
    "opportunity_log": (Local("opportunity_code"),),
    "health_declarations": (Ref("project_id"), Ref("period_id")),
    "project_status_reports": (Ref("project_id"), Ref("period_id")),
    "measurement_development": (Ref("project_id"), Ref("period_id")),
    "measurement_development_defects": (Ref("measurement_id"), Local("sdlc_stage")),
    "measurement_support": (Ref("project_id"), Ref("period_id")),
    "measurement_staffing": (Ref("project_id"), Ref("period_id")),
    "measurement_staffing_priority_metrics": (Ref("measurement_id"), Local("priority")),
    "measurement_testing": (Ref("project_id"), Ref("period_id")),
    "measurement_cloud_maintenance": (Ref("project_id"), Ref("period_id")),
    "measurement_consulting": (Ref("project_id"), Ref("period_id")),
    "metric_target_development": (Ref("project_id"),),
    "metric_target_support": (Ref("project_id"),),
    "metric_target_staffing": (Ref("project_id"),),
    "metric_target_staffing_priority": (Ref("metric_target_id"), Local("priority")),
    "metric_target_testing": (Ref("project_id"),),
    "metric_target_consulting": (Ref("project_id"),),
    "metric_target_cloud_maintenance": (Ref("project_id"),),
    "metric_target_cloud_migration": (Ref("project_id"),),
    "contractual_commitments": (Ref("project_id"), Local("commitment_name")),  # practical, not DB-unique
    "contractual_commitment_actuals": (Ref("commitment_id"), Local("period_date")),
    "milestone_payments": (Ref("project_id"), Local("milestone_name")),  # practical, not DB-unique
    "milestone_payment_actuals": (Ref("milestone_id"),),
    "de_assessments": (Ref("project_id"), Local("assessment_date")),  # practical, not DB-unique (multiple assessments per day allowed)
    "de_assessment_alerts": (Local("alert_code"),),
    "de_assessment_findings": (Ref("project_id"), Local("sequence_no")),
    "data_integrity_checklist_items": (Local("module_name"), Local("item_name")),
    "integration_connections": (Local("integration_name"),),
    "account_status_reports": (Ref("account_id"), Ref("period_id")),
    "geo_status_reports": (Ref("geo_id"), Ref("period_id")),
    "account_health_declarations": (Ref("account_id"), Ref("period_id")),
    "geo_health_declarations": (Ref("geo_id"), Ref("period_id")),
}

# Tables whose business-key column is normally minted by
# app.services.code_generator.generate_code() rather than typed by hand — see
# registry.CODE_GENERATOR_ENTITY for the matching entity_code. Blank on
# import means "generate one"; every other business-key column must always
# be supplied by the user (there is no service to invent an org code or an
# email address).
GENERATED_CODE_COLUMN: dict[str, str] = {
    "projects": "project_code",
    "risk_log": "risk_code",
    "issue_log": "issue_code",
    "dependency_log": "dependency_code",
    "assumption_log": "assumption_code",
    "opportunity_log": "opportunity_code",
    "de_assessment_alerts": "alert_code",
}
