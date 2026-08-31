"""Governance completeness for the DE Project Approval workspace
(design-reference/de-approval).

Each governance module is scored Complete/Incomplete using the same rules the
New Project charter nav uses (frontend new-project-nav.tsx): the project's own
derived profile/schedule flags plus "has at least one row" checks on the
relevant registers. Overall % and gap counts are computed over the mandatory
subset only; RAIDO and Measurement appear as informational rows.
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
from app.schemas.projects import ProjectRead

# key, label, mandatory
MODULES: list[tuple[GovernanceModuleKey, str, bool]] = [
    (GovernanceModuleKey.PROJECT_PROFILE, "Project Profile", True),
    (GovernanceModuleKey.SCOPE_SCHEDULE, "Scope & Schedule", True),
    (GovernanceModuleKey.MAP_ORACLE_PROJECTS, "Map Oracle Projects", True),
    (GovernanceModuleKey.CONTRACTUAL_COMPLIANCE, "Contractual Compliance", True),
    (GovernanceModuleKey.RAIDO, "RAIDO Register", False),
    (GovernanceModuleKey.MEASUREMENT, "Measurement", False),
]

_INCOMPLETE_GAP_TEXT: dict[GovernanceModuleKey, str] = {
    GovernanceModuleKey.PROJECT_PROFILE: "Project Profile fields incomplete",
    GovernanceModuleKey.SCOPE_SCHEDULE: "Scope & Schedule fields incomplete",
    GovernanceModuleKey.MAP_ORACLE_PROJECTS: "No Oracle project mapped",
    GovernanceModuleKey.CONTRACTUAL_COMPLIANCE: "Missing commitments or payment milestones",
    GovernanceModuleKey.RAIDO: "RAIDO registers incomplete",
    GovernanceModuleKey.MEASUREMENT: "Measurement not yet captured",
}


async def _count(db: AsyncSession, model: type, project_id: UUID) -> int:
    stmt = select(func.count()).select_from(model).where(model.project_id == project_id)
    return (await db.execute(stmt)).scalar_one()


async def _module_complete(db: AsyncSession, key: GovernanceModuleKey, project: Project) -> bool:
    if key is GovernanceModuleKey.PROJECT_PROFILE:
        return ProjectRead.model_validate(project).profile_completion_flag
    if key is GovernanceModuleKey.SCOPE_SCHEDULE:
        return ProjectRead.model_validate(project).schedule_completion_flag
    if key is GovernanceModuleKey.MAP_ORACLE_PROJECTS:
        return await _count(db, ProjectOracleId, project.id) > 0
    if key is GovernanceModuleKey.CONTRACTUAL_COMPLIANCE:
        commitments = await _count(db, ContractualCommitment, project.id)
        milestones = await _count(db, MilestonePayment, project.id)
        return commitments > 0 and milestones > 0
    if key is GovernanceModuleKey.RAIDO:
        counts = [
            await _count(db, RiskLog, project.id),
            await _count(db, IssueLog, project.id),
            await _count(db, DependencyLog, project.id),
            await _count(db, AssumptionLog, project.id),
            await _count(db, OpportunityLog, project.id),
        ]
        return all(c > 0 for c in counts)
    # MEASUREMENT — no backend wiring exists yet.
    return False


async def compute_governance_completeness(db: AsyncSession, project: Project) -> GovernanceCompleteness:
    modules: list[GovernanceModuleStatus] = []
    for key, label, mandatory in MODULES:
        complete = await _module_complete(db, key, project)
        modules.append(
            GovernanceModuleStatus(
                key=key,
                label=label,
                mandatory=mandatory,
                complete=complete,
                gaps=None if complete else _INCOMPLETE_GAP_TEXT[key],
            )
        )

    mandatory_modules = [m for m in modules if m.mandatory]
    mandatory_total = len(mandatory_modules)
    modules_complete = sum(1 for m in mandatory_modules if m.complete)
    modules_incomplete = mandatory_total - modules_complete
    completion_pct = round(100 * modules_complete / mandatory_total) if mandatory_total else 0

    return GovernanceCompleteness(
        completion_pct=completion_pct,
        modules_complete=modules_complete,
        modules_incomplete=modules_incomplete,
        gaps_count=modules_incomplete,
        critical_gaps=modules_incomplete,
        modules=modules,
    )
