"""Computes the Data Integrity Checklist rollup (UX §4.13) at query time — it's
a governance view over every other module's latest data, not stored source
data. Checklist items are free-text admin config (data_integrity_checklist_items),
so this maps a fixed set of well-known module_name values to the table/column
that answers 'when was this last updated for this project'. An admin-added
item whose module_name isn't in this map is conservatively reported as not
updated (unknown freshness) rather than guessed at.
"""

from collections.abc import Awaitable, Callable
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contractual import ContractualCommitment, ContractualCommitmentActual
from app.models.data_integrity import DataIntegrityChecklistItem
from app.models.de_assessment import DEAssessment
from app.models.health_declarations import HealthDeclaration
from app.models.measurement import (
    MeasurementCloudMaintenance,
    MeasurementCloudMigration,
    MeasurementDevelopment,
    MeasurementStaffing,
    MeasurementSupport,
    MeasurementTesting,
)
from app.models.project_status import ProjectStatusReport
from app.models.raid import AssumptionLog, DependencyLog, IssueLog, OpportunityLog, RiskLog


async def _max_date_column(db: AsyncSession, model: type, date_column, project_id: UUID) -> date | None:
    stmt = select(func.max(date_column)).where(model.project_id == project_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _max_updated_at_date(db: AsyncSession, model: type, project_id: UUID) -> date | None:
    stmt = select(func.max(model.updated_at)).where(model.project_id == project_id)
    result = (await db.execute(stmt)).scalar_one_or_none()
    return result.date() if result else None


async def _contractual_actuals_max_date(db: AsyncSession, project_id: UUID) -> date | None:
    stmt = (
        select(func.max(ContractualCommitmentActual.period_date))
        .join(ContractualCommitment, ContractualCommitment.id == ContractualCommitmentActual.commitment_id)
        .where(ContractualCommitment.project_id == project_id)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


MODULE_LOOKUP: dict[str, Callable[[AsyncSession, UUID], Awaitable[date | None]]] = {
    "Project Status": lambda db, pid: _max_date_column(db, ProjectStatusReport, ProjectStatusReport.report_date, pid),
    "Risk Log": lambda db, pid: _max_updated_at_date(db, RiskLog, pid),
    "Issue Log": lambda db, pid: _max_updated_at_date(db, IssueLog, pid),
    "Dependency Log": lambda db, pid: _max_updated_at_date(db, DependencyLog, pid),
    "Assumption Log": lambda db, pid: _max_updated_at_date(db, AssumptionLog, pid),
    "Opportunity Log": lambda db, pid: _max_updated_at_date(db, OpportunityLog, pid),
    "Delivery Declared Project Health": lambda db, pid: _max_date_column(
        db, HealthDeclaration, HealthDeclaration.declaration_date, pid
    ),
    "DE Assessed Project Health": lambda db, pid: _max_date_column(db, DEAssessment, DEAssessment.assessment_date, pid),
    "Development Metrics": lambda db, pid: _max_date_column(
        db, MeasurementDevelopment, MeasurementDevelopment.as_of_date, pid
    ),
    "Support Metrics": lambda db, pid: _max_date_column(db, MeasurementSupport, MeasurementSupport.as_of_date, pid),
    "Professional Staffing Metrics": lambda db, pid: _max_date_column(
        db, MeasurementStaffing, MeasurementStaffing.as_of_date, pid
    ),
    "Testing Metrics": lambda db, pid: _max_date_column(db, MeasurementTesting, MeasurementTesting.as_of_date, pid),
    "Cloud Maintenance Metrics": lambda db, pid: _max_date_column(
        db, MeasurementCloudMaintenance, MeasurementCloudMaintenance.as_of_date, pid
    ),
    "Cloud Migration Metrics": lambda db, pid: _max_date_column(
        db, MeasurementCloudMigration, MeasurementCloudMigration.as_of_date, pid
    ),
    "Contractual Commitment Actuals": lambda db, pid: _contractual_actuals_max_date(db, pid),
}

_CADENCE_WINDOW_DAYS = {
    "Weekly": 7,
    "Monthly": 31,
    "Quarterly": 92,
    "Ad Hoc": None,  # never flagged stale
}


async def compute_status_row(db: AsyncSession, project_id: UUID, item: DataIntegrityChecklistItem) -> dict:
    lookup = MODULE_LOOKUP.get(item.module_name)
    last_updated = await lookup(db, project_id) if lookup else None

    window = _CADENCE_WINDOW_DAYS.get(item.expected_cadence)
    if last_updated is None:
        is_updated = False
    elif window is None:
        is_updated = True
    else:
        is_updated = (date.today() - last_updated).days <= window

    return {
        "module_name": item.module_name,
        "item_name": item.item_name,
        "expected_cadence": item.expected_cadence,
        "last_updated_date": last_updated,
        "is_updated": is_updated,
    }
