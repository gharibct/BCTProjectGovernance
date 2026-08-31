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


async def _max_created_at_date(db: AsyncSession, model: type, project_id: UUID) -> date | None:
    stmt = select(func.max(model.created_at)).where(model.project_id == project_id)
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
    "Delivery Declared Project Health": lambda db, pid: _max_created_at_date(db, HealthDeclaration, pid),
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


def _is_updated(last_updated: date | None, expected_cadence: str) -> bool:
    window = _CADENCE_WINDOW_DAYS.get(expected_cadence)
    if last_updated is None:
        return False
    if window is None:
        return True
    return (date.today() - last_updated).days <= window


def is_critical_gap(last_updated: date | None, expected_cadence: str) -> bool:
    """A stale item counts as 'critical' (for the Project Health dashboard's
    Data Integrity card, design-reference/Project-Health.html) only for the
    two cadences with a real staleness expectation (Weekly/Monthly), and only
    once it's overdue by more than 2x its expected window — or was never
    updated at all."""
    if expected_cadence not in ("Weekly", "Monthly"):
        return False
    window = _CADENCE_WINDOW_DAYS[expected_cadence]
    if last_updated is None:
        return True
    return (date.today() - last_updated).days > 2 * window


async def compute_status_row(db: AsyncSession, project_id: UUID, item: DataIntegrityChecklistItem) -> dict:
    lookup = MODULE_LOOKUP.get(item.module_name)
    last_updated = await lookup(db, project_id) if lookup else None

    return {
        "module_name": item.module_name,
        "item_name": item.item_name,
        "expected_cadence": item.expected_cadence,
        "last_updated_date": last_updated,
        "is_updated": _is_updated(last_updated, item.expected_cadence),
    }


async def _max_date_column_bulk(
    db: AsyncSession, model: type, date_column, project_ids: list[UUID]
) -> dict[UUID, date | None]:
    stmt = select(model.project_id, func.max(date_column)).where(model.project_id.in_(project_ids)).group_by(
        model.project_id
    )
    return dict((await db.execute(stmt)).all())


async def _max_updated_at_date_bulk(db: AsyncSession, model: type, project_ids: list[UUID]) -> dict[UUID, date | None]:
    stmt = select(model.project_id, func.max(model.updated_at)).where(model.project_id.in_(project_ids)).group_by(
        model.project_id
    )
    rows = (await db.execute(stmt)).all()
    return {project_id: (value.date() if value else None) for project_id, value in rows}


async def _max_created_at_date_bulk(db: AsyncSession, model: type, project_ids: list[UUID]) -> dict[UUID, date | None]:
    stmt = select(model.project_id, func.max(model.created_at)).where(model.project_id.in_(project_ids)).group_by(
        model.project_id
    )
    rows = (await db.execute(stmt)).all()
    return {project_id: (value.date() if value else None) for project_id, value in rows}


async def _contractual_actuals_max_date_bulk(db: AsyncSession, project_ids: list[UUID]) -> dict[UUID, date | None]:
    stmt = (
        select(ContractualCommitment.project_id, func.max(ContractualCommitmentActual.period_date))
        .join(ContractualCommitment, ContractualCommitment.id == ContractualCommitmentActual.commitment_id)
        .where(ContractualCommitment.project_id.in_(project_ids))
        .group_by(ContractualCommitment.project_id)
    )
    return dict((await db.execute(stmt)).all())


MODULE_LOOKUP_BULK: dict[str, Callable[[AsyncSession, list[UUID]], Awaitable[dict[UUID, date | None]]]] = {
    "Project Status": lambda db, pids: _max_date_column_bulk(db, ProjectStatusReport, ProjectStatusReport.report_date, pids),
    "Risk Log": lambda db, pids: _max_updated_at_date_bulk(db, RiskLog, pids),
    "Issue Log": lambda db, pids: _max_updated_at_date_bulk(db, IssueLog, pids),
    "Dependency Log": lambda db, pids: _max_updated_at_date_bulk(db, DependencyLog, pids),
    "Assumption Log": lambda db, pids: _max_updated_at_date_bulk(db, AssumptionLog, pids),
    "Opportunity Log": lambda db, pids: _max_updated_at_date_bulk(db, OpportunityLog, pids),
    "Delivery Declared Project Health": lambda db, pids: _max_created_at_date_bulk(db, HealthDeclaration, pids),
    "DE Assessed Project Health": lambda db, pids: _max_date_column_bulk(db, DEAssessment, DEAssessment.assessment_date, pids),
    "Development Metrics": lambda db, pids: _max_date_column_bulk(
        db, MeasurementDevelopment, MeasurementDevelopment.as_of_date, pids
    ),
    "Support Metrics": lambda db, pids: _max_date_column_bulk(db, MeasurementSupport, MeasurementSupport.as_of_date, pids),
    "Professional Staffing Metrics": lambda db, pids: _max_date_column_bulk(
        db, MeasurementStaffing, MeasurementStaffing.as_of_date, pids
    ),
    "Testing Metrics": lambda db, pids: _max_date_column_bulk(db, MeasurementTesting, MeasurementTesting.as_of_date, pids),
    "Cloud Maintenance Metrics": lambda db, pids: _max_date_column_bulk(
        db, MeasurementCloudMaintenance, MeasurementCloudMaintenance.as_of_date, pids
    ),
    "Cloud Migration Metrics": lambda db, pids: _max_date_column_bulk(
        db, MeasurementCloudMigration, MeasurementCloudMigration.as_of_date, pids
    ),
    "Contractual Commitment Actuals": lambda db, pids: _contractual_actuals_max_date_bulk(db, pids),
}


async def compute_status_rows_bulk(
    db: AsyncSession, project_ids: list[UUID], items: list[DataIntegrityChecklistItem]
) -> dict[tuple[UUID, UUID], tuple[bool, date | None]]:
    """Bulk sibling of compute_status_row for a portfolio-wide rollup (the
    Project Health dashboard's Data Integrity card) — one batched GROUP BY
    query per distinct checklist module across every project at once, instead
    of one query per (project, item) pair, which would be
    O(projects x items) awaited DB calls for a portfolio dashboard."""
    if not project_ids or not items:
        return {}

    last_updated_by_module: dict[str, dict[UUID, date | None]] = {}
    for item in items:
        if item.module_name in last_updated_by_module:
            continue
        bulk_lookup = MODULE_LOOKUP_BULK.get(item.module_name)
        last_updated_by_module[item.module_name] = await bulk_lookup(db, project_ids) if bulk_lookup else {}

    result: dict[tuple[UUID, UUID], tuple[bool, date | None]] = {}
    for item in items:
        last_updated_by_project = last_updated_by_module.get(item.module_name, {})
        for project_id in project_ids:
            last_updated = last_updated_by_project.get(project_id)
            result[(project_id, item.id)] = (_is_updated(last_updated, item.expected_cadence), last_updated)
    return result
