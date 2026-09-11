"""Monthly completion for the Project Performance Report's 8 sections
(Measurement, Commitments, Payment Milestones, and the 5 RAIDO logs).

A section is "complete" for a Monthly period if either its data was saved
during that period, or the PM explicitly attested "Reviewed and No Changes"
(monthly_report_attestations). See db/tables/52_monthly_report_attestations.sql.
"""

from collections.abc import Awaitable, Callable
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contractual import (
    ContractualCommitment,
    ContractualCommitmentActual,
    MilestonePayment,
    MilestonePaymentActual,
)
from app.models.measurement import (
    MeasurementCloudMaintenance,
    MeasurementCloudMigration,
    MeasurementConsulting,
    MeasurementDevelopment,
    MeasurementStaffing,
    MeasurementSupport,
    MeasurementTesting,
)
from app.models.raid import AssumptionLog, DependencyLog, IssueLog, OpportunityLog, RiskLog
from app.models.reference_data import ReportingPeriod
from app.models.reporting_attestation import MonthlyReportAttestation
from app.schemas.enums import ReportPageType
from app.schemas.reporting_attestation import PageCompletionStatus

DataSavedCheck = Callable[[AsyncSession, UUID, ReportingPeriod], Awaitable[bool]]


async def _exists(db: AsyncSession, stmt) -> bool:
    return (await db.execute(select(stmt.exists()))).scalar_one()


async def _measurement_saved(db: AsyncSession, project_id: UUID, period: ReportingPeriod) -> bool:
    # Only one of these tables is ever populated for a given project (the form
    # shown is chosen by the project's type), so checking all 6 period-scoped
    # ones is equivalent to — and simpler than — resolving the project's type
    # first.
    period_scoped_models = (
        MeasurementDevelopment,
        MeasurementSupport,
        MeasurementStaffing,
        MeasurementTesting,
        MeasurementConsulting,
        MeasurementCloudMaintenance,
    )
    for model in period_scoped_models:
        if await _exists(
            db, select(model.id).where(model.project_id == project_id, model.period_id == period.id)
        ):
            return True
    # Cloud Migration is event-based (as_of_date, no period_id) — a row inside
    # the period's date range counts the same as a period_id match elsewhere.
    return await _exists(
        db,
        select(MeasurementCloudMigration.id).where(
            MeasurementCloudMigration.project_id == project_id,
            MeasurementCloudMigration.as_of_date >= period.start_date,
            MeasurementCloudMigration.as_of_date <= period.end_date,
        ),
    )


async def _commitments_saved(db: AsyncSession, project_id: UUID, period: ReportingPeriod) -> bool:
    # Commitment Actuals have no updated_at (an existing actual's value can be
    # overwritten without one) but do carry period_date, which is the readings'
    # actual business signal — use that instead of a timestamp.
    return await _exists(
        db,
        select(ContractualCommitmentActual.id)
        .join(ContractualCommitment, ContractualCommitment.id == ContractualCommitmentActual.commitment_id)
        .where(
            ContractualCommitment.project_id == project_id,
            ContractualCommitmentActual.period_date >= period.start_date,
            ContractualCommitmentActual.period_date <= period.end_date,
        ),
    )


async def _payment_milestones_saved(db: AsyncSession, project_id: UUID, period: ReportingPeriod) -> bool:
    # A milestone has exactly one actual row, upserted in place, with no
    # period-of-its-own — updated_at is the only signal for "touched this month".
    return await _exists(
        db,
        select(MilestonePaymentActual.id)
        .join(MilestonePayment, MilestonePayment.id == MilestonePaymentActual.milestone_id)
        .where(
            MilestonePayment.project_id == project_id,
            func.date(MilestonePaymentActual.updated_at) >= period.start_date,
            func.date(MilestonePaymentActual.updated_at) <= period.end_date,
        ),
    )


def _raid_saved_check(model: type) -> DataSavedCheck:
    async def check(db: AsyncSession, project_id: UUID, period: ReportingPeriod) -> bool:
        return await _exists(
            db,
            select(model.id).where(
                model.project_id == project_id,
                or_(
                    func.date(model.created_at).between(period.start_date, period.end_date),
                    func.date(model.updated_at).between(period.start_date, period.end_date),
                ),
            ),
        )

    return check


_DATA_SAVED_CHECKS: dict[ReportPageType, DataSavedCheck] = {
    ReportPageType.MEASUREMENT: _measurement_saved,
    ReportPageType.COMMITMENTS: _commitments_saved,
    ReportPageType.PAYMENT_MILESTONES: _payment_milestones_saved,
    ReportPageType.RISK: _raid_saved_check(RiskLog),
    ReportPageType.ISSUE: _raid_saved_check(IssueLog),
    ReportPageType.DEPENDENCY: _raid_saved_check(DependencyLog),
    ReportPageType.ASSUMPTION: _raid_saved_check(AssumptionLog),
    ReportPageType.OPPORTUNITY: _raid_saved_check(OpportunityLog),
}


async def compute_monthly_completion(
    db: AsyncSession, project_id: UUID, period: ReportingPeriod
) -> list[PageCompletionStatus]:
    attestation_rows = (
        (
            await db.execute(
                select(MonthlyReportAttestation).where(
                    MonthlyReportAttestation.project_id == project_id,
                    MonthlyReportAttestation.period_id == period.id,
                )
            )
        )
        .scalars()
        .all()
    )
    attestation_by_page = {row.page_type: row for row in attestation_rows}

    results: list[PageCompletionStatus] = []
    for page_type, check in _DATA_SAVED_CHECKS.items():
        if await check(db, project_id, period):
            results.append(PageCompletionStatus(page_type=page_type, complete=True, reason="data_saved"))
            continue
        attestation = attestation_by_page.get(page_type.value)
        if attestation is not None:
            results.append(
                PageCompletionStatus(
                    page_type=page_type,
                    complete=True,
                    reason="reviewed_no_changes",
                    reviewed_by=attestation.reviewed_by,
                    reviewed_at=attestation.reviewed_at,
                )
            )
        else:
            results.append(PageCompletionStatus(page_type=page_type, complete=False, reason="outstanding"))
    return results
