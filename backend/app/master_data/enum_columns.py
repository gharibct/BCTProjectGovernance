"""Which (table, column) pairs are governed by one of app.schemas.enums'
StrEnum value sets — there are no DB CHECK constraints (see enums.py's own
docstring), so this is the only place that knows a column is enum-backed at
all; used to render dropdown validation on the template and to validate
values on import. Built by hand from each model file's own "# EnumName"
comment, since models only carry `str`/`str | None` at the type level.
"""

from __future__ import annotations

from app.schemas import enums as e

ENUM_COLUMNS: dict[str, dict[str, type[e.StrEnum]]] = {
    "roles": {"code": e.RoleCode},
    "reporting_periods": {"period_type": e.PeriodType},
    "projects": {
        "contract_type": e.ContractType,
        "project_owned": e.ProjectOwned,
        "billing_type": e.BillingType,
        "engagement_type": e.EngagementType,
        # applicable_phase is multi-select (comma-joined list[ApplicablePhase]),
        # so it can't be a single-enum dropdown/validation here.
        "project_status": e.ProjectStatus,
    },
    "risk_log": {
        "risk_category": e.Category,
        "risk_type": e.RiskType,
        "probability": e.Probability,
        "impact": e.Impact,
        "severity": e.RiskSeverity,
        "response_strategy": e.ResponseStrategy,
        "current_status": e.RiskStatus,
    },
    "issue_log": {
        "priority": e.IssuePriority,
        "severity": e.IssueSeverity,
        "status": e.IssueStatus,
        "escalation_level": e.IssueEscalationLevel,
    },
    "dependency_log": {
        "dependency_type": e.DependencyType,
        "dependency_status": e.DependencyStatus,
        "criticality": e.Criticality,
        "probability_of_delay": e.ProbabilityOfDelay,
        "escalation_level": e.DependencyEscalationLevel,
    },
    "assumption_log": {
        "probability_of_failure": e.ProbabilityOfFailure,
        "impact_rating": e.ImpactRating,
        "validation_status": e.ValidationStatus,
        "current_status": e.AssumptionStatus,
    },
    "opportunity_log": {
        "impact": e.OpportunityImpact,
        "expected_benefit": e.ExpectedBenefit,
        "benefit_type": e.BenefitType,
        "exploitation_strategy": e.ExploitationStrategy,
        "status": e.OpportunityStatus,
    },
    "health_declarations": {
        "core_delivery_rating": e.HealthRating,
        "people_rating": e.HealthRating,
        "operational_rating": e.HealthRating,
        "customer_rating": e.HealthRating,
        "financial_rating": e.HealthRating,
        "compliance_rating": e.HealthRating,
    },
    "account_health_declarations": {
        "core_delivery_rating": e.HealthRating,
        "people_rating": e.HealthRating,
        "operational_rating": e.HealthRating,
        "customer_rating": e.HealthRating,
        "financial_rating": e.HealthRating,
        "compliance_rating": e.HealthRating,
    },
    "geo_health_declarations": {
        "core_delivery_rating": e.HealthRating,
        "people_rating": e.HealthRating,
        "operational_rating": e.HealthRating,
        "customer_rating": e.HealthRating,
        "financial_rating": e.HealthRating,
        "compliance_rating": e.HealthRating,
    },
    "project_health_items": {"category": e.Category},
    "account_health_items": {"category": e.Category},
    "project_status_reports": {"status": e.ReportStatus},
    "account_status_reports": {"status": e.ReportStatus},
    "geo_status_reports": {"status": e.ReportStatus},
    "project_status_items": {"category": e.ProjectStatusCategory},
    "account_status_items": {"category": e.ProjectStatusCategory},
    "geo_status_items": {"category": e.ProjectStatusCategory},
    "measurement_development_defects": {"sdlc_stage": e.SdlcStage},
    "measurement_staffing_priority_metrics": {"priority": e.StaffingPriority},
    "metric_target_staffing_priority": {"priority": e.StaffingPriority},
    "contractual_commitments": {"frequency": e.CommitmentFrequency},
    "contractual_commitment_actuals": {"met_status": e.MetStatus},
    "milestone_payment_actuals": {"status": e.MilestonePaymentStatus},
    "de_assessments": {"de_assessed_project_health": e.HealthRating},
    "de_assessment_alerts": {"alert_category": e.Category},
    "de_assessment_findings": {
        "classification": e.FindingClassification,
        "status": e.FindingStatus,
    },
    "data_integrity_checklist_items": {"expected_cadence": e.ExpectedCadence},
    "integration_connections": {
        "integration_name": e.IntegrationName,
        "connection_status": e.ConnectionStatus,
    },
}
