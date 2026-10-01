from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_project_access, require_project_read_access
from app.core.db import get_db
from app.crud.reporting_attestation import monthly_report_attestation_crud
from app.models.measurement import (
    MeasurementCloudMaintenance,
    MeasurementConsulting,
    MeasurementDevelopment,
    MeasurementDevelopmentDefect,
    MeasurementStaffing,
    MeasurementStaffingPriorityMetric,
    MeasurementSupport,
    MeasurementTesting,
)
from app.models.project_status import ProjectStatusReport
from app.models.reference_data import ReportingPeriod
from app.models.reporting_attestation import MonthlyReportAttestation
from app.models.users import User
from app.schemas.copy_from_latest import CopyFromLatestResult
from app.schemas.enums import RoleCode
from app.services.copy_from_latest import copy_period_rows
from app.services.report_lock import assert_report_editable
from app.schemas.reporting_attestation import MonthlyReportAttestationCreate, MonthlyReportAttestationRead

router = APIRouter(prefix="/projects/{project_id}/monthly-attestations", tags=["Monthly Report Attestation"])

# Same write scope as Contractual Compliance / RAID — PM plus an Account/Geo
# Head acting on a project in their own patch via Work Context.
_write_dep = require_project_access(
    RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN
)
_pm_read = [Depends(require_project_read_access())]


@router.get("", response_model=list[MonthlyReportAttestationRead], dependencies=_pm_read)
async def list_attestations(
    project_id: UUID, period_id: UUID = Query(...), db: AsyncSession = Depends(get_db)
):
    items, _ = await monthly_report_attestation_crud.list(
        db,
        filters={
            MonthlyReportAttestation.project_id: project_id,
            MonthlyReportAttestation.period_id: period_id,
        },
        limit=20,
    )
    return items


@router.post("", response_model=MonthlyReportAttestationRead, status_code=status.HTTP_201_CREATED)
async def create_attestation(
    project_id: UUID,
    payload: MonthlyReportAttestationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_write_dep),
):
    """Record "Reviewed and No Changes" for one Project Performance Report
    section this Monthly period. Idempotent — attesting again just re-stamps
    who/when.
    """
    period = await db.get(ReportingPeriod, payload.period_id)
    if period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reporting period not found")
    if period.period_type != "Monthly":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Attestations only apply to Monthly periods")

    existing, _ = await monthly_report_attestation_crud.list(
        db,
        filters={
            MonthlyReportAttestation.project_id: project_id,
            MonthlyReportAttestation.period_id: payload.period_id,
            MonthlyReportAttestation.page_type: payload.page_type,
        },
        limit=1,
    )
    now = datetime.now(UTC)
    if existing:
        row = existing[0]
        row.reviewed_by = user.id
        row.reviewed_at = now
        await db.flush()
        await db.refresh(row)
        return row

    return await monthly_report_attestation_crud.create(
        db, payload, project_id=project_id, reviewed_by=user.id, reviewed_at=now
    )


# (measurement model, its child-row model) — one row per project + period.
_MEASUREMENT_COPIES = (
    (MeasurementDevelopment, MeasurementDevelopmentDefect),
    (MeasurementSupport, None),
    (MeasurementStaffing, MeasurementStaffingPriorityMetric),
    (MeasurementTesting, None),
    (MeasurementConsulting, None),
    (MeasurementCloudMaintenance, None),
)


@router.post(
    "/copy-from-latest",
    response_model=CopyFromLatestResult,
    dependencies=[Depends(_write_dep)],
)
async def copy_monthly_report_from_latest(
    project_id: UUID, period_id: UUID = Query(...), db: AsyncSession = Depends(get_db)
):
    """"Copy from latest report" for the Monthly Project Performance Report:
    prefill this period's Measurement forms from the latest earlier Monthly
    period. Forms that already have data for this period are left alone."""
    period = await db.get(ReportingPeriod, period_id)
    if period is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reporting period not found")
    if period.period_type != "Monthly":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only Monthly periods can be copied here")
    report_status = (
        await db.execute(
            select(ProjectStatusReport.status).where(
                ProjectStatusReport.project_id == project_id, ProjectStatusReport.period_id == period_id
            )
        )
    ).scalars().first()
    assert_report_editable(report_status)

    copied = 0
    source_period_id = None
    for model, child in _MEASUREMENT_COPIES:
        n, source = await copy_period_rows(
            db, model=model, project_id=project_id, period_id=period_id, child_model=child
        )
        copied += n
        source_period_id = source_period_id or source
    return CopyFromLatestResult(copied=copied, source_period_id=source_period_id)
