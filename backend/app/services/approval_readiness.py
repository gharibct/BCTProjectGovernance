"""Send-To-Approval readiness for the Maintain Project screen.

Scores the modules a Project Manager must complete before a Draft project can be
submitted for DE approval. Mandatory: Project Profile (every field), Scope &
Schedule (every field, including the planned end date), Measurement (every target
metric for the project's type), Commitments (>=1 row), Milestones (>=1 row).
RAIDO is reported but never blocks. Each module also reports partial progress
(fields filled / fields expected); the overall % is field-weighted over the
mandatory subset. Mirrors the shape of services.governance_completeness.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contractual import ContractualCommitment, MilestonePayment
from app.models.metric_target import (
    MetricTargetCloudMaintenance,
    MetricTargetCloudMigration,
    MetricTargetConsulting,
    MetricTargetDevelopment,
    MetricTargetStaffing,
    MetricTargetStaffingPriority,
    MetricTargetSupport,
    MetricTargetTesting,
)
from app.models.projects import Project
from app.models.raid import (
    AssumptionLog,
    DependencyLog,
    IssueLog,
    OpportunityLog,
    RiskLog,
)
from app.models.reference_data import ProjectType
from app.schemas.approval_readiness import ApprovalReadiness, ApprovalReadinessModule
from app.schemas.enums import ProjectStatus, StaffingPriority, YesNo
from app.schemas.metric_target import (
    MetricTargetCloudMaintenanceIn,
    MetricTargetCloudMigrationIn,
    MetricTargetConsultingIn,
    MetricTargetDevelopmentIn,
    MetricTargetSupportIn,
    MetricTargetTestingIn,
)

# key, label, mandatory
MODULES: list[tuple[str, str, bool]] = [
    ("project_profile", "Project Profile", True),
    ("scope_schedule", "Scope & Schedule", True),
    ("measurement", "Measurement", True),
    ("commitments", "Commitments", True),
    ("milestones", "Milestones", True),
    ("raido", "RAIDO Register", False),
]

_GAP_TEXT: dict[str, str] = {
    "project_profile": "Project Profile fields incomplete",
    "scope_schedule": "Customer overview, scope description, planned start date, or planned end date missing",
    "measurement": "Measurement targets not captured",
    "commitments": "No commitments added",
    "milestones": "No payment milestones added",
    "raido": "RAIDO registers incomplete",
}

# Project Profile fields the PM must fill before submission — mirrors
# schemas.projects.ProjectRead.profile_completion_flag. product_id is required
# only when product_flag is Yes, so it is handled separately below.
_PROFILE_BASE_FIELDS: tuple[str, ...] = (
    "project_name",
    "contract_type",
    "project_type_id",
    "project_owned",
    "organization_id",
    "geo_id",
    "region_id",
    "account_id",
    "project_manager_id",
    "delivery_manager_id",
    "project_revenue",
    "project_currency",
    "critical_flag",
    "product_flag",
)

# Flat single-row target tables keyed by ProjectType.code (staffing is handled
# separately because of its per-priority child rows). The required columns for
# each are derived from the matching *In schema rather than hand-listed.
_FLAT_METRIC_TARGET: dict[str, tuple[type, type]] = {
    "DEVELOPMENT": (MetricTargetDevelopment, MetricTargetDevelopmentIn),
    "SUPPORT": (MetricTargetSupport, MetricTargetSupportIn),
    "TESTING": (MetricTargetTesting, MetricTargetTestingIn),
    "CONSULTING": (MetricTargetConsulting, MetricTargetConsultingIn),
    "CLOUD_MAINTENANCE": (MetricTargetCloudMaintenance, MetricTargetCloudMaintenanceIn),
    "CLOUD_MIGRATION": (MetricTargetCloudMigration, MetricTargetCloudMigrationIn),
}

_STAFFING_CODE = "PROFESSIONAL_STAFFING"


def _filled(value: object) -> bool:
    """A str counts only with non-whitespace content; any other non-None value
    counts outright. Local copy of schemas.projects._is_filled."""
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _is_yes(value: object) -> bool:
    return value == YesNo.YES or getattr(value, "value", value) == "Yes"


async def _count(db: AsyncSession, model: type, project_id: UUID) -> int:
    stmt = select(func.count()).select_from(model).where(model.project_id == project_id)
    return (await db.execute(stmt)).scalar_one()


async def _max_updated_at(db: AsyncSession, model: type, project_id: UUID) -> datetime | None:
    stmt = select(func.max(model.updated_at)).where(model.project_id == project_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _raido_max_updated_at(db: AsyncSession, project_id: UUID) -> datetime | None:
    stamps = [
        await _max_updated_at(db, model, project_id)
        for model in (RiskLog, IssueLog, DependencyLog, AssumptionLog, OpportunityLog)
    ]
    present = [s for s in stamps if s is not None]
    return max(present) if present else None


def _target_columns(in_schema: type) -> list[str]:
    return [name for name in in_schema.model_fields if name.startswith("target_")]


def profile_field_progress(project: Project) -> tuple[int, int]:
    """(fields filled, fields expected) for the Project Profile module."""
    total = len(_PROFILE_BASE_FIELDS)
    filled = sum(1 for name in _PROFILE_BASE_FIELDS if _filled(getattr(project, name, None)))
    if _is_yes(getattr(project, "product_flag", None)):
        total += 1
        filled += 1 if _filled(getattr(project, "product_id", None)) else 0
    return filled, total


async def measurement_progress(db: AsyncSession, project: Project) -> tuple[int, int, str | None]:
    """(target fields filled, target fields expected, gap text) for Measurement."""
    if project.project_type_id is None:
        return 0, 1, "No project type set"
    ptype = await db.get(ProjectType, project.project_type_id)
    if ptype is None:
        return 0, 1, "No project type set"

    code = ptype.code
    if code in _FLAT_METRIC_TARGET:
        model, in_schema = _FLAT_METRIC_TARGET[code]
        row = (
            await db.execute(select(model).where(model.project_id == project.id))
        ).scalar_one_or_none()
        columns = _target_columns(in_schema)
        total = len(columns)
        filled = 0 if row is None else sum(1 for col in columns if getattr(row, col) is not None)
        gap = None if filled >= total else f"Measurement targets incomplete for {ptype.name}"
        return filled, total, gap

    if code == _STAFFING_CODE:
        total = 2 + 2 * len(list(StaffingPriority))
        target = (
            await db.execute(
                select(MetricTargetStaffing).where(MetricTargetStaffing.project_id == project.id)
            )
        ).scalar_one_or_none()
        if target is None:
            return 0, total, "Staffing measurement targets incomplete"
        filled = 0
        filled += 1 if _filled(target.target_pct_profiles_qualifying) else 0
        filled += 1 if _filled(target.target_pct_candidates_joining) else 0
        priority_rows = (
            await db.execute(
                select(MetricTargetStaffingPriority).where(
                    MetricTargetStaffingPriority.metric_target_id == target.id
                )
            )
        ).scalars().all()
        by_priority = {r.priority: r for r in priority_rows}
        for priority in StaffingPriority:
            row = by_priority.get(priority.value)
            if row is not None:
                filled += 1 if row.target_avg_response_time_hours is not None else 0
                filled += 1 if row.target_avg_lead_time_days is not None else 0
        gap = None if filled >= total else "Staffing measurement targets incomplete"
        return filled, total, gap

    return 0, 1, "Measurement not applicable for this project type"


async def measurement_complete(db: AsyncSession, project: Project) -> tuple[bool, str | None]:
    filled, total, gap = await measurement_progress(db, project)
    return (total > 0 and filled >= total), gap


async def _module_status(
    db: AsyncSession, key: str, label: str, mandatory: bool, project: Project
) -> ApprovalReadinessModule:
    gap_default: str | None = _GAP_TEXT.get(key)
    gap_override: str | None = None
    last_updated: datetime | None = None

    if key == "project_profile":
        fc, ft = profile_field_progress(project)
        last_updated = project.updated_at
    elif key == "scope_schedule":
        fields = (
            project.customer_overview,
            project.project_scope_description,
            project.planned_start_date,
            project.planned_end_date,
        )
        ft = len(fields)
        fc = sum(1 for v in fields if _filled(v))
        last_updated = project.updated_at
    elif key == "measurement":
        fc, ft, gap_override = await measurement_progress(db, project)
        last_updated = project.updated_at
    elif key == "commitments":
        ft = 1
        fc = 1 if await _count(db, ContractualCommitment, project.id) >= 1 else 0
        last_updated = await _max_updated_at(db, ContractualCommitment, project.id)
    elif key == "milestones":
        ft = 1
        fc = 1 if await _count(db, MilestonePayment, project.id) >= 1 else 0
        last_updated = await _max_updated_at(db, MilestonePayment, project.id)
    elif key == "raido":
        counts = [
            await _count(db, model, project.id)
            for model in (RiskLog, IssueLog, DependencyLog, AssumptionLog, OpportunityLog)
        ]
        ft = len(counts)
        fc = sum(1 for c in counts if c > 0)
        last_updated = await _raido_max_updated_at(db, project.id)
    else:  # pragma: no cover - defensive
        fc, ft = 0, 1

    complete = ft > 0 and fc >= ft
    progress_pct = round(100 * fc / ft) if ft else 0
    return ApprovalReadinessModule(
        key=key,
        label=label,
        mandatory=mandatory,
        complete=complete,
        gaps=None if complete else (gap_override or gap_default),
        last_updated=last_updated,
        fields_complete=fc,
        fields_total=ft,
        progress_pct=progress_pct,
    )


async def compute_approval_readiness(db: AsyncSession, project: Project) -> ApprovalReadiness:
    modules = [
        await _module_status(db, key, label, mandatory, project)
        for key, label, mandatory in MODULES
    ]

    mandatory_modules = [m for m in modules if m.mandatory]
    mandatory_total = len(mandatory_modules)
    modules_complete = sum(1 for m in mandatory_modules if m.complete)
    modules_incomplete = mandatory_total - modules_complete

    fields_total = sum(m.fields_total for m in mandatory_modules)
    fields_complete = sum(m.fields_complete for m in mandatory_modules)
    completion_pct = round(100 * fields_complete / fields_total) if fields_total else 0

    return ApprovalReadiness(
        completion_pct=completion_pct,
        modules_complete=modules_complete,
        modules_incomplete=modules_incomplete,
        gaps_count=modules_incomplete,
        critical_gaps=modules_incomplete,
        modules=modules,
        project_status=project.project_status,
        lifecycle_status=project.lifecycle_status,
        can_submit=modules_incomplete == 0
        and project.project_status in (ProjectStatus.DRAFT, ProjectStatus.UNDER_AMENDMENT),
    )
