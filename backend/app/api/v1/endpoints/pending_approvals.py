from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import false, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import _owned_account_ids, _owned_geo_ids, _role_code, get_current_user, project_scope_conditions
from app.core.db import get_db
from app.models.projects import Project
from app.models.project_status import ProjectStatusReport
from app.models.reference_data import Account, ReportingPeriod
from app.models.regional_status import AccountStatusReport
from app.models.users import User
from app.schemas.enums import ReportStatus, RoleCode

# Worklist feeds for "Approve Project / Account Delivery Status": only the
# reports sitting in Submitted, i.e. actually awaiting a decision.
router = APIRouter(prefix="/pending-approvals", tags=["Status Review"])


class PendingApprovalRow(BaseModel):
    entity_id: UUID
    entity_code: str | None = None
    entity_name: str
    report_id: UUID
    period_id: UUID
    period_label: str
    period_type: str


@router.get("/projects", response_model=list[PendingApprovalRow])
async def pending_project_approvals(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ProjectStatusReport, Project, ReportingPeriod)
        .join(Project, Project.id == ProjectStatusReport.project_id)
        .join(ReportingPeriod, ReportingPeriod.id == ProjectStatusReport.period_id)
        .where(
            ProjectStatusReport.status == ReportStatus.SUBMITTED,
            *await project_scope_conditions(db, current_user),
        )
        .order_by(Project.project_code, ReportingPeriod.start_date.desc())
    )
    return [
        PendingApprovalRow(
            entity_id=project.id,
            entity_code=project.project_code,
            entity_name=project.project_name,
            report_id=report.id,
            period_id=period.id,
            period_label=period.label,
            period_type=period.period_type,
        )
        for report, project, period in (await db.execute(stmt)).all()
    ]


@router.get("/accounts", response_model=list[PendingApprovalRow])
async def pending_account_approvals(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    role_code = await _role_code(db, current_user)
    conditions: list = []
    if role_code == RoleCode.GEO_HEAD:
        geo_ids = await _owned_geo_ids(db, current_user)
        conditions.append(Account.geo_id.in_(geo_ids) if geo_ids else false())
    elif role_code == RoleCode.ACCOUNT_MANAGER:
        account_ids = await _owned_account_ids(db, current_user)
        conditions.append(Account.id.in_(account_ids) if account_ids else false())
    elif role_code not in (RoleCode.ADMIN, RoleCode.CDO):
        conditions.append(false())

    stmt = (
        select(AccountStatusReport, Account, ReportingPeriod)
        .join(Account, Account.id == AccountStatusReport.account_id)
        .join(ReportingPeriod, ReportingPeriod.id == AccountStatusReport.period_id)
        .where(AccountStatusReport.status == ReportStatus.SUBMITTED, *conditions)
        .order_by(Account.name, ReportingPeriod.start_date.desc())
    )
    return [
        PendingApprovalRow(
            entity_id=account.id,
            entity_name=account.name,
            report_id=report.id,
            period_id=period.id,
            period_label=period.label,
            period_type=period.period_type,
        )
        for report, account, period in (await db.execute(stmt)).all()
    ]
