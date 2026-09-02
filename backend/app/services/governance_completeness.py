"""Governance completeness for the DE Project Approval workspace
(design-reference/de-approval).

Each governance module is scored Complete/Incomplete using the same rules the
PM's "Send To Approval" screen enforces (services.approval_readiness): the
project's own profile fields, the scope/schedule fields (including the planned
end date), the per-project-type metric targets, and "has at least one row"
checks on the relevant registers. Every module also reports partial progress
(fields filled / fields expected); the overall % is field-weighted over the
mandatory subset. RAIDO appears as an informational row.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contractual import ContractualCommitment, MilestonePayment
from app.models.projects import Project, ProjectOracleId
from app.models.raid import (
    AssumptionLog,
    DependencyLog,
    IssueLog,
    OpportunityLog,
    RiskLog,
)
from app.schemas.de_approval import GovernanceCompleteness, GovernanceModuleStatus
from app.schemas.enums import GovernanceModuleKey
from app.schemas.projects import _is_filled
from app.services.approval_readiness import measurement_progress, profile_field_progress

# key, label, mandatory
MODULES: list[tuple[GovernanceModuleKey, str, bool]] = [
    (GovernanceModuleKey.PROJECT_PROFILE, "Project Profile", True),
    (GovernanceModuleKey.SCOPE_SCHEDULE, "Scope & Schedule", True),
    (GovernanceModuleKey.MAP_ORACLE_PROJECTS, "Map Oracle Projects", True),
    (GovernanceModuleKey.CONTRACTUAL_COMPLIANCE, "Contractual Compliance", True),
    (GovernanceModuleKey.RAIDO, "RAIDO Register", False),
    (GovernanceModuleKey.MEASUREMENT, "Measurement", True),
]

_INCOMPLETE_GAP_TEXT: dict[GovernanceModuleKey, str] = {
    GovernanceModuleKey.PROJECT_PROFILE: "Project Profile fields incomplete",
    GovernanceModuleKey.SCOPE_SCHEDULE: (
        "Customer overview, scope description, planned start date, or planned end date missing"
    ),
    GovernanceModuleKey.MAP_ORACLE_PROJECTS: "No Oracle project mapped",
    GovernanceModuleKey.CONTRACTUAL_COMPLIANCE: "Missing commitments or payment milestones",
    GovernanceModuleKey.RAIDO: "RAIDO registers incomplete",
    GovernanceModuleKey.MEASUREMENT: "Measurement targets not captured",
}


async def _count(db: AsyncSession, model: type, project_id: UUID) -> int:
    stmt = select(func.count()).select_from(model).where(model.project_id == project_id)
    return (await db.execute(stmt)).scalar_one()


async def _module_progress(
    db: AsyncSession, key: GovernanceModuleKey, project: Project
) -> tuple[int, int, str | None]:
    """Return (fields_complete, fields_total, gap_override) for one module."""
    if key is GovernanceModuleKey.PROJECT_PROFILE:
        fc, ft = profile_field_progress(project)
        return fc, ft, None
    if key is GovernanceModuleKey.SCOPE_SCHEDULE:
        fields = (
            project.customer_overview,
            project.project_scope_description,
            project.planned_start_date,
            project.planned_end_date,
        )
        return sum(1 for v in fields if _is_filled(v)), len(fields), None
    if key is GovernanceModuleKey.MAP_ORACLE_PROJECTS:
        return (1 if await _count(db, ProjectOracleId, project.id) > 0 else 0), 1, None
    if key is GovernanceModuleKey.CONTRACTUAL_COMPLIANCE:
        commitments = await _count(db, ContractualCommitment, project.id)
        milestones = await _count(db, MilestonePayment, project.id)
        return (1 if commitments > 0 else 0) + (1 if milestones > 0 else 0), 2, None
    if key is GovernanceModuleKey.RAIDO:
        counts = [
            await _count(db, RiskLog, project.id),
            await _count(db, IssueLog, project.id),
            await _count(db, DependencyLog, project.id),
            await _count(db, AssumptionLog, project.id),
            await _count(db, OpportunityLog, project.id),
        ]
        return sum(1 for c in counts if c > 0), len(counts), None
    if key is GovernanceModuleKey.MEASUREMENT:
        return await measurement_progress(db, project)
    return 0, 1, None  # pragma: no cover - defensive


async def compute_governance_completeness(db: AsyncSession, project: Project) -> GovernanceCompleteness:
    modules: list[GovernanceModuleStatus] = []
    for key, label, mandatory in MODULES:
        fc, ft, gap_override = await _module_progress(db, key, project)
        complete = ft > 0 and fc >= ft
        modules.append(
            GovernanceModuleStatus(
                key=key,
                label=label,
                mandatory=mandatory,
                complete=complete,
                gaps=None if complete else (gap_override or _INCOMPLETE_GAP_TEXT[key]),
                fields_complete=fc,
                fields_total=ft,
                progress_pct=round(100 * fc / ft) if ft else 0,
            )
        )

    mandatory_modules = [m for m in modules if m.mandatory]
    mandatory_total = len(mandatory_modules)
    modules_complete = sum(1 for m in mandatory_modules if m.complete)
    modules_incomplete = mandatory_total - modules_complete

    fields_total = sum(m.fields_total for m in mandatory_modules)
    fields_complete = sum(m.fields_complete for m in mandatory_modules)
    completion_pct = round(100 * fields_complete / fields_total) if fields_total else 0

    return GovernanceCompleteness(
        completion_pct=completion_pct,
        modules_complete=modules_complete,
        modules_incomplete=modules_incomplete,
        gaps_count=modules_incomplete,
        critical_gaps=modules_incomplete,
        modules=modules,
    )
